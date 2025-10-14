import { db } from '../src/';
// biome-ignore lint/performance/noNamespaceImport: <explanation>
import * as schema from '../src/schema';

async function clearDbMessages() {
  try {
    await db.update(schema.dbChannel).set({
      lastIndexedMessageId: null,
    });

    const tables = [schema.dbAttachments, schema.dbMessage];

    for (const table of tables) {
      await db.delete(table);
    }
    console.log('Cleared Messages');
  } catch (e) {
    console.error('Failed to clear messages', e);
  }
}

await clearDbMessages();
