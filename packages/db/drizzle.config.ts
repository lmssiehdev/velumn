import { defineConfig } from 'drizzle-kit';
import { DATABASE_URL } from './src';
export default defineConfig({
  dialect: 'postgresql',
  schema: 'src/schema/index.ts',
  out: './src/drizzle',
  dbCredentials: {
    url: DATABASE_URL,
  },
});
