import { db } from '../src/';
// biome-ignore lint/performance/noNamespaceImport: <explanation>
import * as schema from '../src/schema';

async function clearDbMessages() {
  try {
    const tables = [schema.dbAttachments, schema.dbMessage, schema.dbChannel];

    for (const table of tables) {
      await db.delete(table);
    }
    console.log('Cleared Messages');
  } catch (e) {
    console.error('Failed to clear messages', e);
  }
}

await clearDbMessages();
