import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
// biome-ignore lint/performance/noNamespaceImport: <explanation>
import * as schema from './schema';

export const dbConfig = {
  enabled: true,
  host: '127.0.0.1',
  user: 'discord-indexer',
  database: 'discord-indexer',
  password: 'root',
  port: 5432,
};

const poolConnection = new pg.Pool({
  ...dbConfig,
  // biome-ignore lint/style/noMagicNumbers: <explanation>
  idleTimeoutMillis: 60 * 1000,
});

poolConnection.on('connect', () => {
  console.info('Connected to database');
});

poolConnection.on('error', (err) => {
  console.error('pg pool error:', err);
});

export const db = drizzle({
  client: poolConnection,
  schema,
});
