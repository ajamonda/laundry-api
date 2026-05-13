import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { classifyException } from '../../../src/common/errors/classify-exception';
import { DomainError } from '../../../src/common/errors/domain-error';

class TestDomainError extends DomainError {
  readonly code = 'TEST_DOMAIN_CODE';
  constructor() {
    super('a domain error happened', HttpStatus.CONFLICT);
  }
}

const makePrisma = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('prisma message leak', {
    code,
    clientVersion: 'x.y.z',
  });

describe('classifyException', () => {
  describe('DomainError', () => {
    it('forwards code / status / message and stays silent', () => {
      const result = classifyException(new TestDomainError());
      expect(result).toEqual({
        status: HttpStatus.CONFLICT,
        code: 'TEST_DOMAIN_CODE',
        message: 'a domain error happened',
        logLevel: 'silent',
        logOriginal: false,
      });
    });
  });

  describe('HttpException (built-in)', () => {
    it('uses HTTP_<STATUS> as code and extracts message from the exception', () => {
      const result = classifyException(new NotFoundException('thing missing'));
      expect(result.status).toBe(404);
      expect(result.code).toBe('HTTP_404');
      expect(result.message).toBe('thing missing');
      expect(result.logOriginal).toBe(false);
    });

    it('flattens array messages (ValidationPipe shape) into a semicolon-joined string', () => {
      const result = classifyException(
        new BadRequestException({ message: ['a must be int', 'b is required'], error: 'Bad Request' }),
      );
      expect(result.status).toBe(400);
      expect(result.code).toBe('HTTP_400');
      expect(result.message).toBe('a must be int; b is required');
    });

    it('handles ConflictException with default message', () => {
      const result = classifyException(new ConflictException());
      expect(result.status).toBe(409);
      expect(result.code).toBe('HTTP_409');
    });
  });

  describe('Prisma.PrismaClientKnownRequestError', () => {
    it('P2025 → 404 RESOURCE_NOT_FOUND with masked message + warn-level log', () => {
      const result = classifyException(makePrisma('P2025'));
      expect(result.status).toBe(404);
      expect(result.code).toBe('RESOURCE_NOT_FOUND');
      expect(result.message).toBe('Resource not found');
      expect(result.message).not.toContain('prisma message leak');
      expect(result.logLevel).toBe('warn');
      expect(result.logOriginal).toBe(true);
    });

    it('P2002 → 409 UNIQUE_CONFLICT with masked message (defensive net — repos should withIdempotency)', () => {
      const result = classifyException(makePrisma('P2002'));
      expect(result.status).toBe(409);
      expect(result.code).toBe('UNIQUE_CONFLICT');
      expect(result.message).toBe('Unique constraint violation');
      expect(result.logOriginal).toBe(true);
    });

    it('any other Prisma code → 500 INTERNAL_DB_ERROR with masked message + error-level log', () => {
      const result = classifyException(makePrisma('P2003')); // FK violation
      expect(result.status).toBe(500);
      expect(result.code).toBe('INTERNAL_DB_ERROR');
      expect(result.message).toBe('Internal server error');
      expect(result.message).not.toContain('prisma message leak');
      expect(result.logLevel).toBe('error');
    });
  });

  describe('unknown throws', () => {
    it('plain Error → 500 INTERNAL_ERROR with masked message', () => {
      const result = classifyException(new Error('something with file path /etc/passwd'));
      expect(result.status).toBe(500);
      expect(result.code).toBe('INTERNAL_ERROR');
      expect(result.message).toBe('Internal server error');
      expect(result.message).not.toContain('/etc/passwd');
      expect(result.logLevel).toBe('error');
      expect(result.logOriginal).toBe(true);
    });

    it('non-Error throw (string, object) → 500 INTERNAL_ERROR', () => {
      expect(classifyException('boom').code).toBe('INTERNAL_ERROR');
      expect(classifyException({ what: 'this' }).code).toBe('INTERNAL_ERROR');
      expect(classifyException(null).code).toBe('INTERNAL_ERROR');
    });
  });
});
