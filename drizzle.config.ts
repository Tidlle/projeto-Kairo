import type { Config } from 'drizzle-kit';

export default {
  schema: './packages/db/schema.ts',
  out: './packages/db/migrations',
  dialect: 'postgresql',
} satisfies Config;
