import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '..', '.env.test'), override: true });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL not loaded from .env.test');
}
if (!/laundry_test/.test(process.env.DATABASE_URL)) {
  throw new Error(
    `Refusing to run tests: DATABASE_URL does not point at a *_test database (got "${process.env.DATABASE_URL}")`,
  );
}
