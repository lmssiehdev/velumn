import { sql } from "drizzle-orm";
import {
	check,
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { dbServer, snowflake } from "./discord";

export const domainLifecycleStatusEnum = pgEnum("domain_lifecycle_status", [
	"unconfigured",
	"provisioning",
	"pending",
	"verified",
	"removing",
]);

export type DomainLifecycleStatus =
	(typeof domainLifecycleStatusEnum.enumValues)[number];

export const dbDomainLifecycle = pgTable(
	"db_domain_lifecycle",
	{
		serverId: snowflake("server_id")
			.primaryKey()
			.references(() => dbServer.id, { onDelete: "cascade" }),
		domain: text("domain"),
		status: domainLifecycleStatusEnum("status")
			.notNull()
			.default("unconfigured"),
		generation: integer("generation").notNull().default(0),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("domain_lifecycle_domain_idx").on(table.domain),
		check("domain_lifecycle_generation_check", sql`${table.generation} >= 0`),
		check(
			"domain_lifecycle_state_check",
			sql`(${table.status} = 'unconfigured' AND ${table.domain} IS NULL) OR (${table.status} <> 'unconfigured' AND ${table.domain} IS NOT NULL)`,
		),
	],
);

export type DBDomainLifecycle = typeof dbDomainLifecycle.$inferSelect;
export type DBDomainLifecycleInsert = typeof dbDomainLifecycle.$inferInsert;
