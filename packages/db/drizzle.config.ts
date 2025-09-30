import { defineConfig } from 'drizzle-kit';
import { dbEnv } from './src/env';

export default defineConfig({
  dialect: 'postgresql',
  schema: 'src/schema/index.ts',
  out: './src/drizzle',
  dbCredentials: {
    url: dbEnv.DATABASE_URL,
  },
});
