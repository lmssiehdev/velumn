import {
	type DBIndexingGatewayMutation,
	dbIndexingGatewayMutation,
} from "../schema";
import { z } from "zod";

export class IndexingGatewayMutationRowDecodeError extends Error {
	readonly name = "IndexingGatewayMutationRowDecodeError";

	constructor(readonly field: keyof DBIndexingGatewayMutation | "row") {
		super(`Invalid indexing gateway mutation claim field: ${field}`);
	}
}

const gatewayMutationStatusSchema = z.enum(["pending", "processing"]);
const integerDriverValueSchema = z.union([
	z.number(),
	z.string().regex(/^-?\d+$/),
]);
const gatewayTimestampPattern =
	/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/;
const gatewayTimestampSchema = z.union([
	z.date(),
	z.string().regex(gatewayTimestampPattern),
]);
const nullableGatewayTimestampSchema = gatewayTimestampSchema.nullable();
const stringValueSchema = z.string();
const nullableStringValueSchema = stringValueSchema.nullable();
const jsonValueSchema = z.json();
const claimedGatewayMutationRowSchema = z.object({
	id: z.unknown(),
	submissionId: z.unknown(),
	orderingKey: z.unknown(),
	mutation: z.unknown(),
	submittedAt: z.unknown(),
	status: z.unknown(),
	attemptCount: z.unknown(),
	nextAttemptAt: z.unknown(),
	leaseOwner: z.unknown(),
	leaseExpiresAt: z.unknown(),
	lastErrorCode: z.unknown(),
	createdAt: z.unknown(),
	updatedAt: z.unknown(),
});

export type RawIndexingGatewayMutation = z.input<
	typeof claimedGatewayMutationRowSchema
>;

export function decodeClaimedIndexingGatewayMutation(
	value: Parameters<typeof claimedGatewayMutationRowSchema.safeParse>[0],
): DBIndexingGatewayMutation {
	const parsedRow = claimedGatewayMutationRowSchema.safeParse(value);
	if (!parsedRow.success) {
		throw new IndexingGatewayMutationRowDecodeError("row");
	}
	const row = parsedRow.data;
	const id = decodeSafeInteger(row.id, "id", 1);
	const attemptCount = decodeSafeInteger(row.attemptCount, "attemptCount", 0);
	const status = gatewayMutationStatusSchema.safeParse(row.status);
	if (!status.success) {
		throw new IndexingGatewayMutationRowDecodeError("status");
	}

	return {
		id,
		submissionId: decodeString(row.submissionId, "submissionId"),
		orderingKey: decodeString(row.orderingKey, "orderingKey"),
		mutation: decodeJson(row.mutation),
		submittedAt: decodeDate(row.submittedAt, "submittedAt"),
		status: status.data,
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
	value: Parameters<typeof integerDriverValueSchema.safeParse>[0],
	field: "attemptCount" | "id",
	minimum: number,
): number {
	const parsed = integerDriverValueSchema.safeParse(value);
	if (!parsed.success) {
		throw new IndexingGatewayMutationRowDecodeError(field);
	}
	const decoded =
		field === "id"
			? z
					.number()
					.parse(dbIndexingGatewayMutation.id.mapFromDriverValue(parsed.data))
			: Number(parsed.data);
	if (!Number.isSafeInteger(decoded) || decoded < minimum) {
		throw new IndexingGatewayMutationRowDecodeError(field);
	}
	return decoded;
}

function decodeDate(
	value: Parameters<typeof gatewayTimestampSchema.safeParse>[0],
	field:
		| "createdAt"
		| "leaseExpiresAt"
		| "nextAttemptAt"
		| "submittedAt"
		| "updatedAt",
): Date {
	const parsed = gatewayTimestampSchema.safeParse(value);
	if (!parsed.success) {
		throw new IndexingGatewayMutationRowDecodeError(field);
	}
	const input = parsed.data;
	const parts =
		input instanceof Date ? null : gatewayTimestampPattern.exec(input);
	const decoded = z
		.date()
		.parse(dbIndexingGatewayMutation.submittedAt.mapFromDriverValue(input));
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
	value: Parameters<typeof nullableGatewayTimestampSchema.safeParse>[0],
	field: "leaseExpiresAt",
): Date | null {
	return value === null ? null : decodeDate(value, field);
}

function decodeString(
	value: Parameters<typeof stringValueSchema.safeParse>[0],
	field: "orderingKey" | "status" | "submissionId",
): string {
	const parsed = stringValueSchema.safeParse(value);
	if (!parsed.success) {
		throw new IndexingGatewayMutationRowDecodeError(field);
	}
	return parsed.data;
}

function decodeNullableString(
	value: Parameters<typeof nullableStringValueSchema.safeParse>[0],
	field: "lastErrorCode" | "leaseOwner",
): string | null {
	const parsed = nullableStringValueSchema.safeParse(value);
	if (!parsed.success) {
		throw new IndexingGatewayMutationRowDecodeError(field);
	}
	return parsed.data;
}

function decodeJson(
	value: Parameters<typeof jsonValueSchema.safeParse>[0],
): DBIndexingGatewayMutation["mutation"] {
	const serialized = z.string().safeParse(value);
	if (!serialized.success) {
		const parsed = jsonValueSchema.safeParse(value);
		if (parsed.success) return parsed.data;
		throw new IndexingGatewayMutationRowDecodeError("mutation");
	}
	try {
		return jsonValueSchema.parse(JSON.parse(serialized.data));
	} catch {
		throw new IndexingGatewayMutationRowDecodeError("mutation");
	}
}
