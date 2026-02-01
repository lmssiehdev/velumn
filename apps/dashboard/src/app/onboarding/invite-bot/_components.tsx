"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTRPC } from "@/lib/trpc";

export function InviteBotStatusMessage({ serverId }: { serverId: string }) {
	const router = useRouter();
	const [now, setNow] = useState(Date.now());
	const [lastChecked, setLastChecked] = useState(0);
	const trpc = useTRPC();

	const serverExists = useSuspenseQuery(
		trpc.server.checkIfServerExistsForUser.queryOptions(
			{ serverId },
			{
				enabled: true,
				refetchInterval: 10_000,
				refetchIntervalInBackground: true,
			},
		),
	);

	useEffect(() => {
		if (serverExists.data === true) {
			router.push(`/onboarding/select-channels/${serverId}`);
		}
	}, [serverExists.data, serverId, router]);

	useEffect(() => {
		if (serverExists.dataUpdatedAt > 0) {
			setLastChecked(serverExists.dataUpdatedAt);
		}
	}, [serverExists.dataUpdatedAt]);

	useEffect(() => {
		const interval = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(interval);
	}, []);

	return (
		<div className="space-y-2 text-center">
			<div className="text-neutral-600">
				Waiting for the bot to join your server... You'll be redirected
				automatically once it does.
			</div>
			{lastChecked > 0 && (
				<div className="flex items-center justify-center gap-1 text-gray-500 text-sm">
					<span className={serverExists.isPending ? "animate-pulse" : ""}>
						{serverExists.isPending ? "Checking..." : "Last checked"}
					</span>
					{!serverExists.isPending && (
						<span className="font-medium">
							{Math.max(Math.floor((now - lastChecked) / 1000), 0)} seconds ago
						</span>
					)}
				</div>
			)}
		</div>
	);
}
