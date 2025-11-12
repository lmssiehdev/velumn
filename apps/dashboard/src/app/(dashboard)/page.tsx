import {
	ArrowUpRightIcon,
	DiscordLogoIcon,
} from "@phosphor-icons/react/dist/ssr";
import { getAllThreads } from "@repo/db/helpers/servers";
import { emojiToTwemoji } from "@repo/utils/helpers/twemoji";
import Link from "next/link";
import ThreadsTable from "@/components/threads-table";
import { Button } from "@/components/ui/button";
import { getCurrentUserOrRedirect } from "@/server/user";

export default async function Page() {
	const { user } = await getCurrentUserOrRedirect();
	if (!user.serverId) {
		return <div>No server linked.</div>;
	}
	const latestThreads = await getAllThreads("server", {
		id: user.serverId,
		pinned: false,
		page: 1,
	});

	if (latestThreads.threads?.length === 0) {
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
						We're indexing your Discord channels. This usually takes a few
						minutes for your first time.
					</p>
				</div>

				<div className="w-full max-w-lg space-y-4 text-center">
					<p className="text-muted-foreground text-sm">
						While you wait, here's what happens next:
					</p>
					<div className="grid gap-3 text-sm">
						<div className="flex items-center gap-3 rounded-lg bg-muted/50 p-4">
							<span className="text-2xl">✓</span>
							<span className="text-left">
								Your threads will appear here automatically
							</span>
						</div>
						<div className="flex items-center gap-3 rounded-lg bg-muted/50 p-4">
							<span className="text-2xl">✓</span>
							<span className="text-left">
								No action needed - just grab a coffee ☕
							</span>
						</div>
					</div>
				</div>

				<div className="space-y-3 border-t pt-6 text-center">
					<p className="text-muted-foreground text-sm">Been waiting a while?</p>
					<div className="flex flex-col justify-center gap-3 sm:flex-row">
						<Button asChild size="sm" variant="outline">
							<Link href="/channels">
								<ArrowUpRightIcon />
								Check Channel Settings
							</Link>
						</Button>
						<Button asChild size="sm" variant="ghost">
							<a
								href="https://discord.gg/YOUR_INVITE_CODE"
								rel="noopener noreferrer"
								target="_blank"
							>
								<DiscordLogoIcon /> Get Help on Discord
							</a>
						</Button>
					</div>
				</div>
			</div>
		);
	}

	return <ThreadsTable data={latestThreads.threads} />;
}
