import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "..";
import {
	type DBDomainLifecycle,
	dbDomainLifecycle,
	dbServer,
} from "../schema";

type ActiveDomainStatus = Exclude<
	DBDomainLifecycle["status"],
	"unconfigured" | "removing"
>;

class ProjectionConflict extends Error {}

export async function getDomainLifecycle(serverId: string) {
	return await db.query.dbDomainLifecycle.findFirst({
		where: { serverId },
	});
}

export async function reserveDomainForServer({
	serverId,
	domain,
}: {
	serverId: string;
	domain: string;
}) {
	try {
		return await db.transaction(async (tx) => {
			await tx
				.insert(dbDomainLifecycle)
				.values({ serverId })
				.onConflictDoNothing();

			const [lifecycle] = await tx
				.update(dbDomainLifecycle)
				.set({
					domain,
					status: "provisioning",
					generation: sql`${dbDomainLifecycle.generation} + 1`,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(dbDomainLifecycle.serverId, serverId),
						eq(dbDomainLifecycle.status, "unconfigured"),
						isNull(dbDomainLifecycle.domain),
					),
				)
				.returning();
			if (!lifecycle) return null;

			const projected = await tx
				.update(dbServer)
				.set({ customDomain: domain, domainVerified: false })
				.where(and(eq(dbServer.id, serverId), isNull(dbServer.customDomain)))
				.returning({ serverId: dbServer.id });
			if (projected.length === 0) throw new ProjectionConflict();

			return lifecycle;
		});
	} catch (error) {
		if (error instanceof ProjectionConflict) return null;
		throw error;
	}
}

export async function completeDomainProvisioning({
	serverId,
	domain,
	generation,
}: DomainTransitionInput) {
	return await transitionActiveDomain({
		serverId,
		domain,
		generation,
		expectedStatuses: ["provisioning"],
		status: "pending",
		verified: false,
	});
}

export async function releaseDomainProvisioning({
	serverId,
	domain,
	generation,
}: DomainTransitionInput) {
	return await clearDomain({
		serverId,
		domain,
		generation,
		expectedStatus: "provisioning",
	});
}

export async function beginDomainVerification(
	serverId: string,
): Promise<DBDomainLifecycle | null> {
	const [lifecycle] = await db
		.select()
		.from(dbDomainLifecycle)
		.where(
			and(
				eq(dbDomainLifecycle.serverId, serverId),
				inArray(dbDomainLifecycle.status, [
					"provisioning",
					"pending",
					"verified",
				]),
			),
		)
		.limit(1);
	return lifecycle ?? null;
}

export async function completeDomainVerification({
	serverId,
	domain,
	generation,
	verified,
}: DomainTransitionInput & { verified: boolean }) {
	return await transitionActiveDomain({
		serverId,
		domain,
		generation,
		expectedStatuses: ["provisioning", "pending", "verified"],
		status: verified ? "verified" : "pending",
		verified,
	});
}

export async function beginDomainRemoval(
	serverId: string,
): Promise<DBDomainLifecycle | null> {
	try {
		return await db.transaction(async (tx) => {
			const [lifecycle] = await tx
				.update(dbDomainLifecycle)
				.set({
					status: "removing",
					generation: sql`CASE WHEN ${dbDomainLifecycle.status} = 'removing' THEN ${dbDomainLifecycle.generation} ELSE ${dbDomainLifecycle.generation} + 1 END`,
					updatedAt: sql`CASE WHEN ${dbDomainLifecycle.status} = 'removing' THEN ${dbDomainLifecycle.updatedAt} ELSE ${new Date()} END`,
				})
				.where(
					and(
						eq(dbDomainLifecycle.serverId, serverId),
						inArray(dbDomainLifecycle.status, [
							"pending",
							"verified",
							"removing",
						]),
					),
				)
				.returning();
			if (!lifecycle?.domain) return null;

			const projected = await tx
				.update(dbServer)
				.set({ domainVerified: false })
				.where(
					and(
						eq(dbServer.id, serverId),
						eq(dbServer.customDomain, lifecycle.domain),
					),
				)
				.returning({ serverId: dbServer.id });
			if (projected.length === 0) throw new ProjectionConflict();

			return lifecycle;
		});
	} catch (error) {
		if (error instanceof ProjectionConflict) return null;
		throw error;
	}
}

export async function completeDomainRemoval({
	serverId,
	domain,
	generation,
}: DomainTransitionInput) {
	return await clearDomain({
		serverId,
		domain,
		generation,
		expectedStatus: "removing",
	});
}

export async function getServerByCustomDomain(domain: string) {
	return await db.query.dbServer.findFirst({
		where: { customDomain: domain },
	});
}

type DomainTransitionInput = {
	serverId: string;
	domain: string;
	generation: number;
};

async function transitionActiveDomain({
	serverId,
	domain,
	generation,
	expectedStatuses,
	status,
	verified,
}: DomainTransitionInput & {
	expectedStatuses: ActiveDomainStatus[];
	status: ActiveDomainStatus;
	verified: boolean;
}) {
	try {
		return await db.transaction(async (tx) => {
			const [lifecycle] = await tx
				.update(dbDomainLifecycle)
				.set({
					status,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(dbDomainLifecycle.serverId, serverId),
						eq(dbDomainLifecycle.domain, domain),
						eq(dbDomainLifecycle.generation, generation),
						inArray(dbDomainLifecycle.status, expectedStatuses),
					),
				)
				.returning();
			if (!lifecycle) return null;

			const projected = await tx
				.update(dbServer)
				.set({ customDomain: domain, domainVerified: verified })
				.where(
					and(eq(dbServer.id, serverId), eq(dbServer.customDomain, domain)),
				)
				.returning({ serverId: dbServer.id });
			if (projected.length === 0) throw new ProjectionConflict();

			return lifecycle;
		});
	} catch (error) {
		if (error instanceof ProjectionConflict) return null;
		throw error;
	}
}

async function clearDomain({
	serverId,
	domain,
	generation,
	expectedStatus,
}: DomainTransitionInput & {
	expectedStatus: "provisioning" | "removing";
}) {
	try {
		return await db.transaction(async (tx) => {
			const [lifecycle] = await tx
				.update(dbDomainLifecycle)
				.set({
					domain: null,
					status: "unconfigured",
					generation: sql`${dbDomainLifecycle.generation} + 1`,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(dbDomainLifecycle.serverId, serverId),
						eq(dbDomainLifecycle.domain, domain),
						eq(dbDomainLifecycle.generation, generation),
						eq(dbDomainLifecycle.status, expectedStatus),
					),
				)
				.returning();
			if (!lifecycle) return false;

			const projected = await tx
				.update(dbServer)
				.set({ customDomain: null, domainVerified: false })
				.where(
					and(eq(dbServer.id, serverId), eq(dbServer.customDomain, domain)),
				)
				.returning({ serverId: dbServer.id });
			if (projected.length === 0) throw new ProjectionConflict();

			return true;
		});
	} catch (error) {
		if (error instanceof ProjectionConflict) return false;
		throw error;
	}
}
