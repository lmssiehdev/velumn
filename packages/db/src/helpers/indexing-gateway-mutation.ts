import {
	type DBIndexingGatewayMutation,
	dbIndexingGatewayMutation,
} from "../schema";

export class IndexingGatewayMutationRowDecodeError extends Error {
	readonly name = "IndexingGatewayMutationRowDecodeError";

	constructor(readonly field: keyof DBIndexingGatewayMutation | "row") {
		super(`Invalid indexing gateway mutation claim field: ${field}`);
	}
}

export type RawIndexingGatewayMutation = Record<string, unknown>;

const gatewayMutationStatuses = new Set<DBIndexingGatewayMutation["status"]>([
	"pending",
	"processing",
]);

export function decodeClaimedIndexingGatewayMutation(
	value: unknown,
): DBIndexingGatewayMutation {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new IndexingGatewayMutationRowDecodeError("row");
	}
	const row = value as RawIndexingGatewayMutation;
	const id = decodeSafeInteger(row.id, "id", 1);
	const attemptCount = decodeSafeInteger(row.attemptCount, "attemptCount", 0);
	const status = decodeString(row.status, "status");
	if (
		!gatewayMutationStatuses.has(status as DBIndexingGatewayMutation["status"])
	) {
		throw new IndexingGatewayMutationRowDecodeError("status");
	}

	return {
		id,
		submissionId: decodeString(row.submissionId, "submissionId"),
		orderingKey: decodeString(row.orderingKey, "orderingKey"),
		mutation: decodeJson(row.mutation),
		submittedAt: decodeDate(row.submittedAt, "submittedAt"),
		status: status as DBIndexingGatewayMutation["status"],
		attemptCount,
		nextAttemptAt: decodeDate(row.nextAttemptAt, "nextAttemptAt"),
		leaseOwner: decodeNullableString(row.leaseOwner, "leaseOwner"),
		leaseExpiresAt: decodeNullableDate(row.leaseExpiresAt, "leaseExpiresAt"),
		lastErrorCode: decodeNullableString(row.lastErrorCode, "lastErrorCode"),
		createdAt: decodeDate(row.createdAt, "createdAt"),
		updatedAt: decodeDate(row.updatedAt, "updatedAt"),
	};
}

function decodeSafeInteger(
	value: unknown,
	field: "attemptCount" | "id",
	minimum: number,
): number {
	if (typeof value !== "number" && typeof value !== "string") {
		throw new IndexingGatewayMutationRowDecodeError(field);
	}
	if (typeof value === "string" && !/^-?\d+$/.test(value)) {
		throw new IndexingGatewayMutationRowDecodeError(field);
	}
	const decoded =
		field === "id"
			? (dbIndexingGatewayMutation.id.mapFromDriverValue(value) as number)
			: Number(value);
	if (!Number.isSafeInteger(decoded) || decoded < minimum) {
		throw new IndexingGatewayMutationRowDecodeError(field);
	}
	return decoded;
}

function decodeDate(
	value: unknown,
	field:
		| "createdAt"
		| "leaseExpiresAt"
		| "nextAttemptAt"
		| "submittedAt"
		| "updatedAt",
): Date {
	if (!(value instanceof Date) && typeof value !== "string") {
		throw new IndexingGatewayMutationRowDecodeError(field);
	}
	const parts =
		typeof value === "string"
			? /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/.exec(
					value,
				)
			: null;
	if (typeof value === "string" && !parts) {
		throw new IndexingGatewayMutationRowDecodeError(field);
	}
	const decoded = dbIndexingGatewayMutation.submittedAt.mapFromDriverValue(
		value,
	) as Date;
	if (!Number.isFinite(decoded.getTime())) {
		throw new IndexingGatewayMutationRowDecodeError(field);
	}
	if (
		parts &&
		(decoded.getUTCFullYear() !== Number(parts[1]) ||
			decoded.getUTCMonth() + 1 !== Number(parts[2]) ||
			decoded.getUTCDate() !== Number(parts[3]) ||
			decoded.getUTCHours() !== Number(parts[4]) ||
			decoded.getUTCMinutes() !== Number(parts[5]) ||
			decoded.getUTCSeconds() !== Number(parts[6]) ||
			decoded.getUTCMilliseconds() !==
				Number((parts[7] ?? "").padEnd(3, "0").slice(0, 3)))
	) {
		throw new IndexingGatewayMutationRowDecodeError(field);
	}
	return decoded;
}

function decodeNullableDate(
	value: unknown,
	field: "leaseExpiresAt",
): Date | null {
	return value === null ? null : decodeDate(value, field);
}

function decodeString(
	value: unknown,
	field: "orderingKey" | "status" | "submissionId",
): string {
	if (typeof value !== "string") {
		throw new IndexingGatewayMutationRowDecodeError(field);
	}
	return value;
}

function decodeNullableString(
	value: unknown,
	field: "lastErrorCode" | "leaseOwner",
): string | null {
	if (value === null) return null;
	if (typeof value !== "string") {
		throw new IndexingGatewayMutationRowDecodeError(field);
	}
	return value;
}

function decodeJson(value: unknown): unknown {
	if (typeof value !== "string") return value;
	try {
		return JSON.parse(value);
	} catch {
		throw new IndexingGatewayMutationRowDecodeError("mutation");
	}
}
