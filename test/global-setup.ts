import { execSync } from 'child_process';
import { config } from 'dotenv';
import { resolve } from 'path';

export default async function globalSetup() {
  config({ path: resolve(__dirname, '..', '.env.test'), override: true });

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing in .env.test');
  if (!/laundry_test/.test(url)) {
    throw new Error(`Refusing to migrate: DATABASE_URL is not a *_test database (${url})`);
  }

  const env = { ...process.env, DATABASE_URL: url };
  const cwd = resolve(__dirname, '..');

  console.log('\n[test-setup] prisma migrate deploy → laundry_test');
  execSync('npx prisma migrate deploy', { cwd, env, stdio: 'inherit' });

  console.log('[test-setup] prisma db seed → laundry_test');
  execSync('npx prisma db seed', { cwd, env, stdio: 'inherit' });
}
