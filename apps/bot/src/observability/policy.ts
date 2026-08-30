import { createHash } from "node:crypto";
import { Cause, Option, Schema } from "effect";

export const reportBoundaries = [
	"application",
	"discord_event_handler",
	"gateway_receipt_recovery",
	"gateway_poll_attempt",
	"gateway_poll_fiber",
	"projector_poll_attempt",
	"projector_poll_fiber",
	"scheduler_poll_fiber",
	"reconciliation_job",
] as const;

export type ReportBoundary = (typeof reportBoundaries)[number];
export type ReportEnvironment =
	| "development"
	| "production"
	| "test"
	| "unknown";

const staticNamePattern = /^[A-Za-z][A-Za-z0-9]*(?:[._:/-][A-Za-z0-9]+)*$/;
const typePattern = /^[A-Za-z_$][A-Za-z0-9_$.-]{0,127}$/;
const maximumMessageLength = 2_000;
const maximumStackLength = 16_000;
const maximumStackFrames = 40;

const reportBoundarySchema = Schema.Literals(reportBoundaries);
const reportEnvironmentSchema = Schema.Literals([
	"development",
	"production",
	"test",
]);
const decodeReportBoundary = Schema.decodeUnknownOption(reportBoundarySchema);
const decodeReportEnvironment = Schema.decodeUnknownOption(
	reportEnvironmentSchema,
);
const decodeReflectable = Schema.decodeUnknownOption(Schema.ObjectKeyword);
const decodeString = Schema.decodeUnknownOption(Schema.String);
const decodeNumber = Schema.decodeUnknownOption(Schema.Number);
const decodeBoolean = Schema.decodeUnknownOption(Schema.Boolean);
const decodeBigInt = Schema.decodeUnknownOption(Schema.BigInt);

export const reportBoundary = (
	value: Parameters<typeof decodeReportBoundary>[0],
): ReportBoundary | "unknown" =>
	Option.getOrElse(decodeReportBoundary(value), () => "unknown");

export const reportEnvironment = (value: string): ReportEnvironment => {
	return Option.getOrElse(
		decodeReportEnvironment(value.trim()),
		() => "unknown",
	);
};

const truncate = (value: string, maximum: number) =>
	value.length <= maximum
		? value
		: `${value.slice(0, maximum - 12)} [truncated]`;

const sanitizeUrl = (match: string): string => {
	try {
		const parsed = new URL(match);
		if (
			/(?:^|\.)discord(?:app)?\.com$/i.test(parsed.hostname) &&
			/^\/api\/webhooks\//i.test(parsed.pathname)
		) {
			return `${parsed.origin}/api/webhooks/[REDACTED]`;
		}
		if (parsed.username || parsed.password) {
			parsed.username = "REDACTED";
			parsed.password = "";
		}
		parsed.search = parsed.search ? "?[REDACTED]" : "";
		parsed.hash = parsed.hash ? "#[REDACTED]" : "";
		return parsed.toString();
	} catch {
		return "[REDACTED_URL]";
	}
};

export const sanitizeText = (input: string): string => {
	let value = input;
	value = value.replace(
		/-----BEGIN [^-\r\n]+-----[\s\S]*?-----END [^-\r\n]+-----/gi,
		"[REDACTED_PEM]",
	);
	value = value.replace(
		/\b(?:authorization|proxy[_-]?authorization|cookie|set[_-]?cookie|auth)\s*:\s*[^\r\n]*/gi,
		(header) => `${header.slice(0, header.indexOf(":"))}: [REDACTED]`,
	);
	value = value.replace(
		/\b(?:bearer|basic)\s+[A-Za-z0-9._~+/=-]+/gi,
		(token) => `${token.slice(0, token.indexOf(" "))} [REDACTED]`,
	);
	value = value.replace(
		/\b(?:mfa\.[\w-]{20,}|(?:OT[MN][A-Za-z0-9_-]{20,})|(?:[\w-]{24}\.[\w-]{6}\.[\w-]{20,})|(?:eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+))\b/g,
		"[REDACTED_TOKEN]",
	);
	value = value.replace(
		/(["']?)(password|passwd|secret|token|(?:client|api|access|refresh|auth|discord|session)[_-]?(?:password|secret|key|token|cookie|auth)|cookie|auth|authorization)\1\s*[:=]\s*(?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[^\s,;&}]+)/gi,
		"$1$2$1=[REDACTED]",
	);
	value = value.replace(
		/\b(?:postgres(?:ql)?(?:\+[a-z0-9._-]+)?|mysql2?(?:\+[a-z0-9._-]+)?|mongodb(?:\+srv)?|redis(?:\+[a-z0-9._-]+)?):\/\/[^\s<>"']+/gi,
		"[REDACTED_DB_URL]",
	);
	value = value.replace(/\bhttps?:\/\/[^\s<>"']+/gi, sanitizeUrl);
	value = value.replace(
		/(["']?)(request[\s_-]*body|search[\s_-]*query|message[\s_-]*content)\1\s*[:=]\s*[^\r\n]*/gi,
		"$1$2$1: [REDACTED]",
	);
	value = value.replace(
		/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
		"[REDACTED_EMAIL]",
	);
	return value;
};

const safeField = (
	value: Parameters<typeof decodeReflectable>[0],
	key: string,
): Parameters<typeof decodeReflectable>[0] => {
	try {
		const target = Option.getOrUndefined(decodeReflectable(value));
		return target ? Reflect.get(target, key) : undefined;
	} catch {
		return undefined;
	}
};

const safeString = (
	value: Parameters<typeof decodeString>[0],
): string | undefined => {
	const stringValue = Option.getOrUndefined(decodeString(value));
	if (stringValue !== undefined) return stringValue;
	const numberValue = Option.getOrUndefined(decodeNumber(value));
	if (numberValue !== undefined) return String(numberValue);
	const booleanValue = Option.getOrUndefined(decodeBoolean(value));
	if (booleanValue !== undefined) return String(booleanValue);
	const bigintValue = Option.getOrUndefined(decodeBigInt(value));
	if (bigintValue !== undefined) return String(bigintValue);
	return undefined;
};

const isNativeError = (
	value: Parameters<typeof decodeReflectable>[0],
): value is Error => {
	try {
		return value instanceof Error;
	} catch {
		return false;
	}
};

export interface NormalizedError {
	readonly error: Error;
	readonly type: string;
	readonly tag?: string;
	readonly typedOperation?: string;
	readonly message: string;
	readonly stack: string;
}

export const normalizeError = (
	value: Parameters<typeof decodeReflectable>[0],
): NormalizedError => {
	const rawName = safeString(safeField(value, "name"));
	const rawTag = safeString(safeField(value, "_tag"));
	const rawOperation = safeString(safeField(value, "operation"));
	let rawMessage = safeString(safeField(value, "message")) ?? safeString(value);
	let rawStack = safeString(safeField(value, "stack"));

	const typeCandidate = rawName || rawTag || "UnknownError";
	const type = typePattern.test(typeCandidate) ? typeCandidate : "UnknownError";
	const tag = rawTag && typePattern.test(rawTag) ? rawTag : undefined;
	const typedOperation =
		rawOperation && staticNamePattern.test(rawOperation)
			? rawOperation
			: undefined;
	const genericMessage = (message: string | undefined) =>
		!message?.trim() ||
		message.trim() === type ||
		message.trim() === rawTag ||
		/^(?:Error|An error (?:has )?occurred)$/i.test(message.trim());
	const genericStack = (stack: string | undefined) => {
		const firstLine = stack?.split(/\r?\n/, 1)[0]?.trim();
		return (
			!stack ||
			!firstLine ||
			firstLine === type ||
			firstLine === `${type}:` ||
			/^(?:Error|Error:|An error (?:has )?occurred)$/i.test(firstLine)
		);
	};
	let needsMessage = genericMessage(rawMessage);
	let needsStack = genericStack(rawStack);
	let current = value;
	const seen = new WeakSet<object>();
	for (let depth = 0; depth < 5 && (needsMessage || needsStack); depth++) {
		if (!isNativeError(current) || seen.has(current)) break;
		seen.add(current);
		const nested = safeField(current, "cause");
		if (!isNativeError(nested)) break;
		if (needsMessage) {
			const nestedMessage = safeString(safeField(nested, "message"));
			if (!genericMessage(nestedMessage)) {
				rawMessage = nestedMessage;
				needsMessage = false;
			}
		}
		if (needsStack) {
			const nestedStack = safeString(safeField(nested, "stack"));
			if (!genericStack(nestedStack)) {
				rawStack = nestedStack;
				needsStack = false;
			}
		}
		current = nested;
	}
	const message = truncate(
		sanitizeText(rawMessage?.trim() || "Failure details unavailable"),
		maximumMessageLength,
	);
	const stackLines = sanitizeText(rawStack ?? "")
		.split(/\r?\n/)
		.slice(0, maximumStackFrames + 1);
	const fallbackStack = `${type}: ${message}\n    at velumn-bot.observability.capture`;
	const stack = truncate(
		stackLines.length > 1 ? stackLines.join("\n") : fallbackStack,
		maximumStackLength,
	);
	const error = new Error(message);
	Object.defineProperties(error, {
		name: { value: type, configurable: true },
		stack: { value: stack, configurable: true },
	});
	if (tag && typedOperation) {
		return { error, type, tag, typedOperation, message, stack };
	}
	if (tag) return { error, type, tag, message, stack };
	if (typedOperation) return { error, type, typedOperation, message, stack };
	return { error, type, message, stack };
};

export interface CauseSelection {
	readonly inspectable: boolean;
	readonly selectedKind: "Die" | "Fail" | "Unknown";
	readonly selected: unknown;
	readonly failure_kind: "failure" | "defect" | "mixed" | "unknown";
	readonly cause_count: number;
	readonly fail_count: number;
	readonly defect_count: number;
	readonly interrupt_count: number;
	readonly is_composite: boolean;
	readonly has_mixed_failure_kinds: boolean;
}

export const inspectCause = (
	cause: Cause.Cause<unknown>,
): CauseSelection | "interrupt-only" => {
	try {
		const reasons = cause.reasons;
		let selectedDie: unknown;
		let selectedFail: unknown;
		let hasSelectedDie = false;
		let hasSelectedFail = false;
		let failCount = 0;
		let defectCount = 0;
		let interruptCount = 0;
		for (const reason of reasons) {
			const tag = Reflect.get(reason, "_tag");
			if (tag === "Die") {
				defectCount += 1;
				if (!hasSelectedDie) {
					selectedDie = Reflect.get(reason, "defect");
					hasSelectedDie = true;
				}
			} else if (tag === "Fail") {
				failCount += 1;
				if (!hasSelectedFail) {
					selectedFail = Reflect.get(reason, "error");
					hasSelectedFail = true;
				}
			} else if (tag === "Interrupt") {
				interruptCount += 1;
			}
		}
		if (failCount === 0 && defectCount === 0 && interruptCount > 0)
			return "interrupt-only";
		const causeCount = failCount + defectCount + interruptCount;
		const kindCount =
			Number(failCount > 0) +
			Number(defectCount > 0) +
			Number(interruptCount > 0);
		return {
			inspectable: true,
			selectedKind: defectCount > 0 ? "Die" : "Fail",
			selected: defectCount > 0 ? selectedDie : selectedFail,
			failure_kind:
				kindCount > 1 ? "mixed" : defectCount > 0 ? "defect" : "failure",
			cause_count: causeCount,
			fail_count: failCount,
			defect_count: defectCount,
			interrupt_count: interruptCount,
			is_composite: causeCount > 1,
			has_mixed_failure_kinds: kindCount > 1,
		};
	} catch {
		return {
			inspectable: false,
			selectedKind: "Unknown",
			selected: new Error("Failure details unavailable"),
			failure_kind: "unknown",
			cause_count: 0,
			fail_count: 0,
			defect_count: 0,
			interrupt_count: 0,
			is_composite: false,
			has_mixed_failure_kinds: false,
		};
	}
};

export const staticOperation = (
	value: Parameters<typeof decodeString>[0],
	fallback: string,
): string => {
	const parsed = Option.getOrUndefined(decodeString(value));
	return parsed && parsed.length <= 128 && staticNamePattern.test(parsed)
		? parsed
		: fallback;
};

const firstInAppFrame = (stack: string): string => {
	for (const line of stack.split("\n").slice(1)) {
		const match = line.match(
			/^\s*at\s+(?:(?<fn>[^\s(]+)\s+\()?(?<module>[^()]+?)(?::\d+){0,2}\)?$/,
		);
		if (!match?.groups) continue;
		const moduleName = match.groups.module
			?.replace(/^file:\/\//, "")
			.replace(/^.*\/apps\/bot\//, "apps/bot/");
		if (
			!moduleName ||
			moduleName.startsWith("node:") ||
			moduleName.includes("node_modules")
		)
			continue;
		return `${moduleName}:${match.groups.fn ?? "?"}`.slice(0, 256);
	}
	return "unknown:?";
};

export const errorFingerprint = (input: {
	readonly operation: string;
	readonly selectedKind: CauseSelection["selectedKind"];
	readonly type: string;
	readonly typedOperation?: string;
	readonly stack: string;
}): string => {
	const identity = [
		input.operation,
		input.selectedKind,
		input.type,
		input.typedOperation ?? "",
		firstInAppFrame(input.stack),
	].join("\u0000");
	return `velumn:v1:${createHash("sha256").update(identity).digest("hex")}`;
};

export const safeBoundaryMetadata = (
	cause: Cause.Cause<unknown>,
	_context?: { readonly boundary: string },
) => {
	const selection = inspectCause(cause);
	if (selection === "interrupt-only")
		return { failure_kind: "interruption" as const };
	return {
		failure_kind: selection.failure_kind,
		cause_count: selection.cause_count,
		fail_count: selection.fail_count,
		defect_count: selection.defect_count,
		interrupt_count: selection.interrupt_count,
	};
};

export const safeSpanName = (name: string): string =>
	name.length <= 128 && staticNamePattern.test(name)
		? name
		: `operation.${createHash("sha256").update(name).digest("hex").slice(0, 16)}`;

export const sanitizedExporterCause = (
	cause: Cause.Cause<unknown>,
): Cause.Cause<Error> | "interrupt-only" => {
	try {
		const reasons: Array<Cause.Reason<Error>> = [];
		for (const reason of cause.reasons) {
			if (reasons.length >= 8) break;
			const tag = Reflect.get(reason, "_tag");
			if (tag === "Fail") {
				reasons.push(
					Cause.makeFailReason(
						normalizeError(Reflect.get(reason, "error")).error,
					),
				);
			} else if (tag === "Die") {
				reasons.push(
					Cause.makeDieReason(
						normalizeError(Reflect.get(reason, "defect")).error,
					),
				);
			}
		}
		if (reasons.length > 0) return Cause.fromReasons(reasons);
		return "interrupt-only";
	} catch {
		return Cause.fail(
			normalizeError(new Error("Failure details unavailable")).error,
		);
	}
};
