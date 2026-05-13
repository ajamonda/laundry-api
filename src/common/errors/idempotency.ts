import { Prisma } from '@prisma/client';

/**
 * Standard P2002 idempotency wrapper. Use this for every "insert-or-return-
 * existing" repository method whose uniqueness is enforced by a DB UNIQUE
 * constraint (the project's canonical idempotency mechanism — see
 * docs/common/coding-style.md Idempotency rules).
 *
 *   const row = await withIdempotency(
 *     () => client.billingRequest.create({ data: {...} }),
 *     () => client.billingRequest.findUnique({ where: {...} }),
 *   );
 *
 * Contract:
 *   - `insert` MUST be the write that could raise P2002. If it raises any
 *     other Prisma error, it is re-thrown unchanged.
 *   - `fetchExisting` is called ONLY when P2002 was caught. It MUST return
 *     the row that conflicted (the one the unique index pointed at). If it
 *     returns null, the original P2002 is re-thrown (the constraint must
 *     have triggered for a reason we don't understand, and silently
 *     returning null would mask a real bug).
 *   - Both callbacks run on whichever Prisma client the caller passed in
 *     (`prisma` or a `Prisma.TransactionClient`). This helper does not open
 *     a transaction.
 */
export async function withIdempotency<T>(
  insert: () => Promise<T>,
  fetchExisting: () => Promise<T | null>,
): Promise<T> {
  try {
    return await insert();
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const existing = await fetchExisting();
      if (existing) return existing;
    }
    throw e;
  }
}

/**
 * Sister helper for the "insert-or-throw-domain-error" pattern. Use when a
 * DB UNIQUE constraint enforces a domain invariant whose violation should
 * surface as a specific `DomainError` (NOT as "return the existing row").
 *
 *   const row = await mapUniqueConflict(
 *     () => client.routeChangeRequest.create({ data: {...} }),
 *     () => new PendingRouteChangeExistsError(itemId),
 *   );
 *
 * Contract:
 *   - `insert` MUST be the write that could raise P2002. Other Prisma
 *     errors propagate unchanged.
 *   - `errorFactory` is called ONLY on P2002. The returned error is
 *     thrown in place of the Prisma error so the caller sees a domain-
 *     meaningful signal, not a raw P2002 leak.
 *   - This is the only sanctioned shape for "P2002 → throw DomainError"
 *     mapping. Hand-rolled try/catch on P2002 outside `withIdempotency` /
 *     `mapUniqueConflict` is forbidden — see coding-style.md.
 */
export async function mapUniqueConflict<T>(
  insert: () => Promise<T>,
  errorFactory: () => Error,
): Promise<T> {
  try {
    return await insert();
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw errorFactory();
    }
    throw e;
  }
}
