import type { MessageMetadataSchema } from "./validation";

export type PublicMention =
	| {
			id: string;
			state: "available";
			name: string;
			source: "database" | "snapshot";
	  }
	| { id: string; state: "redacted" }
	| { id: string; state: "unavailable" };

export type MentionDatabaseRow = {
	id: string;
	name: string | null;
	redacted?: boolean;
};

export type PublicMessageMentionInput = {
	id: string;
	content: string;
	metadata: MessageMetadataSchema | null;
};

export type PublicMessageMentions = {
	users: PublicMention[];
	channels: PublicMention[];
	roles: PublicMention[];
};

export type PublicReferenceState = "available" | "unavailable" | "redacted";

export function classifyPublicReference({
	exists,
	published,
	messageRedacted,
	authorRedacted,
}: {
	exists: boolean;
	published: boolean;
	messageRedacted: boolean;
	authorRedacted: boolean;
}): PublicReferenceState {
	if (!exists || !published) return "unavailable";
	if (messageRedacted || authorRedacted) return "redacted";
	return "available";
}

const USER_MENTION = /<@!?(\d{1,20})>/g;
const CHANNEL_MENTION = /<#(\d{1,20})>/g;
const ROLE_MENTION = /<@&(\d{1,20})>/g;

export function collectPublicMentionIds(messages: PublicMessageMentionInput[]) {
	const users = new Set<string>();
	const channels = new Set<string>();

	for (const message of messages) {
		for (const id of matchingIds(message.content, USER_MENTION)) users.add(id);
		for (const id of matchingIds(message.content, CHANNEL_MENTION))
			channels.add(id);
		for (const id of Object.keys(message.metadata?.users ?? {})) users.add(id);
		for (const id of Object.keys(message.metadata?.channels ?? {}))
			channels.add(id);
	}

	return { users: [...users], channels: [...channels] };
}

export function enrichPublicMessageMentions(
	messages: PublicMessageMentionInput[],
	userRows: MentionDatabaseRow[],
	channelRows: MentionDatabaseRow[],
): Map<string, PublicMessageMentions> {
	const users = new Map(userRows.map((row) => [row.id, row]));
	const channels = new Map(channelRows.map((row) => [row.id, row]));
	const result = new Map<string, PublicMessageMentions>();

	for (const message of messages) {
		result.set(message.id, {
			users: projectMentions(
				orderedIds(message.content, USER_MENTION, message.metadata?.users),
				users,
				(id) => {
					const snapshot = message.metadata?.users?.[id];
					return snapshot?.globalName ?? snapshot?.username ?? null;
				},
			),
			channels: projectMentions(
				orderedIds(
					message.content,
					CHANNEL_MENTION,
					message.metadata?.channels,
				),
				channels,
				(id) => message.metadata?.channels?.[id]?.name ?? null,
			),
			roles: projectMentions(
				orderedIds(message.content, ROLE_MENTION, message.metadata?.roles),
				new Map(),
				(id) => message.metadata?.roles?.[id]?.name ?? null,
			),
		});
	}

	return result;
}

function projectMentions(
	ids: string[],
	rows: Map<string, MentionDatabaseRow>,
	snapshotName: (id: string) => string | null,
): PublicMention[] {
	return ids.map((id) => {
		const row = rows.get(id);
		if (row?.redacted) return { id, state: "redacted" };
		if (row?.name) {
			return { id, state: "available", name: row.name, source: "database" };
		}
		const snapshot = snapshotName(id);
		return snapshot
			? { id, state: "available", name: snapshot, source: "snapshot" }
			: { id, state: "unavailable" };
	});
}

function orderedIds(
	content: string,
	pattern: RegExp,
	snapshots: Record<string, unknown> | undefined,
): string[] {
	return [
		...new Set([
			...matchingIds(content, pattern),
			...Object.keys(snapshots ?? {}),
		]),
	];
}

function matchingIds(content: string, pattern: RegExp): string[] {
	return [...content.matchAll(pattern)].flatMap((match) =>
		match[1] ? [match[1]] : [],
	);
}
