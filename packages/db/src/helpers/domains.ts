import { and, eq, isNull } from "drizzle-orm";
import { db } from "..";
import { type DBServer, dbServer } from "../schema";

export async function updateDomainLinkToServer({
	serverId,
	payload,
}: {
	serverId: string;
	payload: Pick<DBServer, "domainVerified" | "customDomain">;
}) {
	return await db
		.update(dbServer)
		.set(payload)
		.where(eq(dbServer.id, serverId));
}

export async function updateDomainLinkToServerIfCurrent({
	serverId,
	expectedCustomDomain,
	payload,
}: {
	serverId: string;
	expectedCustomDomain: string | null;
	payload: Pick<DBServer, "domainVerified" | "customDomain">;
}) {
	const updated = await db
		.update(dbServer)
		.set(payload)
		.where(
			and(
				eq(dbServer.id, serverId),
				expectedCustomDomain === null
					? isNull(dbServer.customDomain)
					: eq(dbServer.customDomain, expectedCustomDomain),
			),
		)
		.returning({ serverId: dbServer.id });

	return updated.length > 0;
}

export async function getServerByCustomDomain(domain: string) {
	return await db.query.dbServer.findFirst({
		where: {
			customDomain: domain,
		},
	});
}
