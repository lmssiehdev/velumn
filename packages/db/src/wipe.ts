import pg from 'pg';
import { dbConfig } from './index.js';

async function dropDatabase() {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  const pool = new pg.Pool({
    ...dbConfig,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
  });

  try {
    await pool.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'discord-indexer'`
    );
    await pool.query('DROP DATABASE IF EXISTS "discord-indexer"');
    await pool.query(
      'CREATE DATABASE "discord-indexer" OWNER "discord-indexer"'
    );
    console.log('Database wiped successfully');
  } catch (error) {
    console.error('Error dropping database:', error);
  } finally {
    await pool.end();
  }
}

dropDatabase();
