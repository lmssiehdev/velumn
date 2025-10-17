import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import { relations } from './schema/relations';

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema, relations });
