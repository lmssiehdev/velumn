import { defineConfig } from 'drizzle-kit';
import { dbConfig } from './src/index';

export default defineConfig({
  dialect: 'postgresql',
  schema: 'src/schema.ts',
  out: './src/drizzle',
  dbCredentials: {
    ...dbConfig,
    ssl: false,
  },
});
