import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import { dbEnv } from './env';

// TODO: move to env lol
// export const DATABASE_URL =
//   'postgresql://neondb_owner:npg_QKinmFA0UN1D@ep-tiny-shape-ad0yf61u-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const sql = neon(dbEnv.DATABASE_URL);

export const db = drizzle(sql, {
  schema,
});
