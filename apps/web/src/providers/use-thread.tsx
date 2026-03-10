"use client";

import { createContext, useContext, useMemo } from "react";
import type { ThreadWithMetadata } from "@/app/(forum)/thread/[...id]/page";

const ThreadContext = createContext<{
	thread: ThreadWithMetadata;
} | null>(null);

export function useThread() {
	const context = useContext(ThreadContext);
	if (!context) {
		throw new Error("useThread must be used within a ThreadProvider");
	}
	return context;
}

export function ThreadProvider({
	children,
	thread,
}: {
	children: React.ReactNode;
	thread: ThreadWithMetadata;
}) {
	const value = useMemo(
		() => ({
			thread,
		}),
		[thread],
	);

	return (
		<ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>
	);
}
