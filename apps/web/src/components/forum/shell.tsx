import { ChatsCircleIcon, HashIcon } from "@phosphor-icons/react/dist/ssr";
import type { DBServer } from "@repo/db/schema/index";
import { ChannelType } from "discord-api-types/v10";
import Link from "next/link";
import { TrackLink } from "@/components/analytics/track-link";
import { SearchPortal } from "@/components/search/search-input";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getTopicsInServerCached } from "@/utils/cache";

export function ForumShell({ children }: { children: React.ReactNode }) {
	return (
		<div className="mx-auto flex min-h-screen flex-col">
			<div className="border-neutral-300 border-b">
				<div className="mx-auto flex h-[52px] max-w-5xl items-center justify-between border-x border-neutral-300 p-2 px-4">
					<Link className="text-black text-xl" href="/">
						Velumn
					</Link>
					<div id="search-box"></div>
				</div>
			</div>
			<div className="mx-auto w-full max-w-5xl flex-1 px-2 py-2 pb-10">
				{children}
			</div>
			<div className="mt-auto border-x border-t border-neutral-300">
				<div className="mx-auto max-w-5xl border-neutral-300 p-2 px-4">
					Powered by Velumn
				</div>
			</div>
		</div>
	);
}

export async function FrontPageSidebar({
	server,
	activeChannelId,
	homeHref,
}: {
	server: DBServer;
	activeChannelId?: string;
	homeHref: string;
}) {
	return (
		<div className="hidden w-full max-w-xs space-y-6 md:block">
			<ServerInfo homeHref={homeHref} server={server} />
			<Boards
				activeChannelId={activeChannelId}
				homeHref={homeHref}
				serverId={server.id}
			/>
		</div>
	);
}

export function ServerInfo({
	server,
	homeHref,
}: {
	server?: DBServer;
	homeHref: string;
}) {
	if (!server) {
		return null;
	}

	return (
		<div className="border border-neutral-300 p-4">
			<div>
				<Link className="text-lg hover:underline" href={homeHref}>
					{server.name}
				</Link>
				<div className="mb-3 flex items-center gap-1.5 text-neutral-700 text-sm">
					<span className="inline-block rounded-full bg-gray-700 size-1.5" />
					{server.memberCount} members
				</div>
			</div>
			<p className="my-3">{server.description}</p>
			<TrackLink
				className={buttonVariants({
					className:
						"pointer cursor-pointer bg-purple-100 text-purple-600 transition-all hover:bg-purple-200",
				})}
				href={`https://discord.gg/${server.serverInvite!}`}
				rel="noopener noreferrer"
				target="_blank"
				eventKey="joinServer"
				eventData={{
					serverId: server.id,
					serverInvite: server.serverInvite!,
				}}
			>
				Join Server
			</TrackLink>
			<SearchPortal serverId={server.id} />
		</div>
	);
}

async function Boards({
	serverId,
	activeChannelId,
	homeHref,
}: {
	serverId: string;
	activeChannelId?: string;
	homeHref: string;
}) {
	const topics = [...(await getTopicsInServerCached(serverId))].sort((a, b) =>
		a.type > b.type ? -1 : 1,
	);

	return (
		<div className="border border-neutral-300 p-4">
			<div className="mb-2 flex items-center justify-between gap-2 pl-2">
				<div>Boards</div>
				{activeChannelId && (
					<Link
						className="cursor-pointer px-2 py-2 text-xs transition-all hover:bg-purple-200 hover:text-purple-500"
						href={homeHref}
					>
						show all
					</Link>
				)}
			</div>
			{topics.map((topic) => (
				<Link
					className={cn(
						"flex cursor-pointer items-center gap-2 p-2 transition-all duration-200 hover:bg-purple-100 hover:text-purple-600",
						{
							"bg-purple-100 text-purple-600": activeChannelId === topic.id,
						},
					)}
					href={`/channel/${topic.id}`}
					key={topic.id}
				>
					<div>
						{topic.type === ChannelType.GuildForum ? (
							<ChatsCircleIcon className="size-4" />
						) : (
							<HashIcon className="size-4" weight="bold" />
						)}
					</div>
					<div>{topic.channelName}</div>
				</Link>
			))}
		</div>
	);
}
