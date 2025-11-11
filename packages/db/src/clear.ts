import { db } from '.';
import * as schema from './schema';

async function clearAllTables() {
  const tables = [
    schema.dbAttachments,
    schema.dbMessage,
    schema.dbChannel,
    schema.dbServer,
    schema.dbDiscordUser,
    schema.user,
    schema.session,
    schema.account,
    schema.verification,
    schema.pendingDiscordInvite,
  ];

  for (const table of tables) {
    await db.delete(table);
  }
  console.log("Cleared DB!")
}

await clearAllTables();
