"use client";

import type { getAllThreads } from "@repo/db/helpers/servers";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { ThreadsEmptyState } from "@/components/threads-empty-state";
import ThreadsTable from "@/components/threads-table";
import { useTRPC } from "@/lib/trpc";

interface ServerPageClientProps {
	initialThreads: Awaited<ReturnType<typeof getAllThreads>>;
	serverId: string;
}

function ServerPageClientContent({
	initialThreads,
	serverId,
}: ServerPageClientProps) {
	const trpc = useTRPC();

	const threadsQuery = useSuspenseQuery(
		trpc.server.getServerThreads.queryOptions(
			{ serverId, pinned: false, page: 1 },
			{
				enabled: initialThreads?.threads?.length === 0,
				refetchInterval: 30000,
				refetchIntervalInBackground: true,
			},
		),
	);

	if (threadsQuery.data.threads?.length === 0) {
		return <ThreadsEmptyState serverId={serverId} />;
	}

	return <ThreadsTable data={threadsQuery.data.threads} />;
}

export default function ServerPageClient(props: ServerPageClientProps) {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<ServerPageClientContent {...props} />
		</Suspense>
	);
}
