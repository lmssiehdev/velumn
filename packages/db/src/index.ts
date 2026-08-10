import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { relations } from "./schema/relations";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) throw new Error("DATABASE_URL is required");

const databaseUrl = new URL(connectionString);

// node-postgres already uses the operating system trust store by default. It
// otherwise interprets PlanetScale's `sslrootcert=system` as a file path.
if (databaseUrl.searchParams.get("sslrootcert") === "system") {
	databaseUrl.searchParams.delete("sslrootcert");
}

export const db = drizzle(databaseUrl.toString(), { schema, relations });
