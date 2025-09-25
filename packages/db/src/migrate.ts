// src/migrate.ts

import { migrate } from 'drizzle-orm/neon-http/migrator';
import { db } from '.';

const main = async () => {
    try {
        await migrate(db, { migrationsFolder: 'src/drizzle' });
        console.log('Migration completed');
    } catch (error) {
        console.error('Error during migration:', error);
        process.exit(1);
    }
};

main();