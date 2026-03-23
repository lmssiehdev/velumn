import { eq } from "drizzle-orm";
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

export async function getServerByCustomDomain(domain: string) {
	return await db.query.dbServer.findFirst({
		where: {
			customDomain: domain,
		},
	});
}
