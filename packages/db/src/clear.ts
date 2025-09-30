import { db } from '.';
// biome-ignore lint/performance/noNamespaceImport: <explanation>
import * as schema from './schema';

export async function clearAllTables() {
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
    ];

    for (const table of tables) {
        await db.delete(table);
    }

}

await clearAllTables();
