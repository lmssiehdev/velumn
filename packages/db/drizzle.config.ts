import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: 'src/schema/index.ts',
  out: './src/drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
