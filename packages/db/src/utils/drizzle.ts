import { getTableColumns, type SQL, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

export const buildConflictUpdateColumns = <
	T extends PgTable,
	Q extends keyof T["_"]["columns"],
>(
	table: T,
	columns: Q[],
) => {
	const cls = getTableColumns(table);
	const updateColumns: Partial<Record<Q, SQL>> = {};
	for (const column of columns) {
		const columnName = cls[column]?.name;
		updateColumns[column] = sql.raw(`excluded.${columnName}`);
	}
	return updateColumns;
};
