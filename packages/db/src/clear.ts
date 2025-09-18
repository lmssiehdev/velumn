// utils/clearDatabase.ts
import { db } from '.';
import * as schema from './schema';

export async function clearAllTables() {
  const tables = [
    schema.dbAttachments,
    schema.dbMessage,
    schema.dbChannel,
    schema.dbServer,
    schema.dbDiscordUser,
  ];

  for (const table of tables) {
    await db.delete(table);
  }

  await db.$client.end();
}

clearAllTables();
