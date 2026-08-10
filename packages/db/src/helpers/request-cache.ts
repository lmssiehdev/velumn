import { AsyncLocalStorage } from "node:async_hooks";

const requestReads = new AsyncLocalStorage<Map<string, Promise<unknown>>>();

export function withDatabaseRequestCache<T>(operation: () => T): T {
	if (requestReads.getStore()) return operation();
	return requestReads.run(new Map(), operation);
}

export async function dedupeDatabaseRead<T>(
	key: string,
	operation: () => Promise<T>,
): Promise<T> {
	const reads = requestReads.getStore();
	if (!reads) return operation();

	const existing = reads.get(key) as Promise<T> | undefined;
	if (existing) return existing;

	const pending = operation();
	reads.set(key, pending);
	try {
		return await pending;
	} catch (error) {
		if (reads.get(key) === pending) reads.delete(key);
		throw error;
	}
}
