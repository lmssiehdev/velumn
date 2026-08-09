export type IndexingChannelDeletionScope = "self" | "tree";

export type StoredDeletionChannel = {
	readonly id: string;
	readonly serverId: string;
};

type LoadDeletionLevel = (
	pendingIds: readonly string[],
	includeChildren: boolean,
) => Promise<readonly StoredDeletionChannel[]>;

export async function collectIndexingChannelDeletionIds(
	rootId: string,
	scope: IndexingChannelDeletionScope,
	loadLevel: LoadDeletionLevel,
): Promise<readonly StoredDeletionChannel[]> {
	const channels: StoredDeletionChannel[] = [];
	let pending = [rootId];
	while (pending.length > 0) {
		const level = await loadLevel(pending, scope === "tree");
		const known = new Set(channels.map(({ id }) => id));
		const discovered = level.filter(({ id }) => !known.has(id));
		channels.push(...discovered);
		pending =
			scope === "tree"
				? discovered.filter(({ id }) => id !== rootId).map(({ id }) => id)
				: [];
	}
	return channels;
}
