// import pg from 'pg';
// import { url } from './index;

// async function dropDatabase() {
//   if (process.env.NODE_ENV === 'production') {
//     return;
//   }
//   const pool = new pg.Pool({
//     connectionString: url,
//   });

//   try {
//     await pool.query(
//       `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'discord-indexer'`
//     );
//     await pool.query('DROP DATABASE IF EXISTS "discord-indexer"');
//     await pool.query(
//       'CREATE DATABASE "discord-indexer" OWNER "discord-indexer"'
//     );
//     console.info('Database wiped successfully');
//   } catch (error) {
//     console.error('Error dropping database:', error);
//   } finally {
//     await pool.end();
//   }
// }

// dropDatabase();
