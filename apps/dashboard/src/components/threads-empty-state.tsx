"use client";

import {
	ArrowsClockwiseIcon,
	ArrowUpRightIcon,
	DiscordLogoIcon,
} from "@phosphor-icons/react/dist/ssr";
import { emojiToTwemoji } from "@repo/utils/helpers/twemoji";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";

interface ThreadsEmptyStateProps {
	serverId: string;
}

export function ThreadsEmptyState({ serverId }: ThreadsEmptyStateProps) {
	const [now, setNow] = useState(Date.now());
	const [lastChecked, _setLastChecked] = useState(Date.now());

	useEffect(() => {
		const interval = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(interval);
	}, []);

	return (
		<div className="flex min-h-[400px] flex-col items-center justify-center space-y-6 p-8">
			<div className="max-w-lg space-y-3 text-center">
				<h2 className="font-semibold text-2xl">
					Getting your threads ready{" "}
					<img
						alt="emoji"
						className="inline-block h-6 w-6"
						src={emojiToTwemoji("⏳")}
					/>
				</h2>
				<p className="text-lg text-muted-foreground">
					We're actively indexing your Discord channels. This usually takes a
					few minutes for your first time.
				</p>
			</div>

			<div className="flex items-center justify-center gap-1 text-gray-500 text-sm">
				<ArrowsClockwiseIcon className="size-4" />
				<span>
					Last checked{" "}
					<span className="font-medium">
						{Math.max(Math.floor((now - lastChecked) / 1000), 0)} seconds ago
					</span>
				</span>
			</div>

			<div className="space-y-3 border-t pt-6 text-center">
				<p className="text-muted-foreground text-sm">Been waiting a while?</p>
				<div className="flex flex-col justify-center gap-3 sm:flex-row">
					<Button asChild size="sm" variant="outline">
						<Link href={`/server/${serverId}/channels`}>
							<ArrowUpRightIcon />
							Check Channel Settings
						</Link>
					</Button>
					<a
						className={buttonVariants({ size: "sm", variant: "ghost" })}
						href="https://velumn.com/discord"
						rel="noopener noreferrer"
						target="_blank"
					>
						<DiscordLogoIcon /> Get Help on Discord
					</a>
				</div>
			</div>
		</div>
	);
}
