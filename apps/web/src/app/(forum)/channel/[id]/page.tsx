import { FrontPageSidebar } from "@/components/forum/shell";
import { ThreadList } from "@/components/forum/thread-list";
import { getAllThreadsCached, getChannelInfoCached } from "@/utils/cache";
import {
	getCustomDomainUrl,
	getMainSiteUrl,
	hasVerifiedCustomDomain,
} from "@/lib/domains";
import { permanentRedirect } from "next/navigation";
import { parseForumPage, type ForumSearchParams } from "../../_lib/pagination";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	const channel = await getChannelInfoCached(id);

	if (!channel) {
		return {
			title: "Channel Not Found",
			openGraph: {
				title: "Channel Not Found",
			},
		};
	}
	return {
		title: channel?.channelName,
		alternates: {
			canonical: getMainSiteUrl(`/channel/${id}`),
		},
		openGraph: {
			title: channel?.channelName,
		},
	};
}

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<ForumSearchParams>;
}) {
	const { id: channelId } = await params;
	// !! TODO: do these in one join
	const channel = await getChannelInfoCached(channelId);
	const searchParamsPage = await parseForumPage(searchParams);

	if (!channel?.server) {
		return <div>Channel doesn't exist</div>;
	}

	if (hasVerifiedCustomDomain(channel.server)) {
		permanentRedirect(getCustomDomainUrl(channel.server, `/channel/${channelId}`));
	}

	const [regularResult, pinnedResult] = await Promise.all([
		getAllThreadsCached("channel", {
			id: channelId,
			pinFilter: "unpinned",
			page: searchParamsPage,
		}),
		getAllThreadsCached("channel", {
			id: channelId,
			pinFilter: "pinned",
		}),
	]);

	const { threads, hasMore, page } = regularResult;
	const { threads: pinnedThread } = pinnedResult;

	return (
		<div className="mx-auto p-4">
			<h2 className="mb-6 max-w-4xl text-balance font-medium text-3xl tracking-tight lg:text-4xl">
				Join a Discussion
			</h2>
			<div className="flex gap-6">
				<ThreadList
					hasMore={hasMore}
					hrefBase={`/channel/${channelId}`}
					page={page}
					threads={threads.concat(pinnedThread)}
				/>
				<FrontPageSidebar
					activeChannelId={channel.id}
					homeHref={`/server/${channel.server.id}`}
					server={channel.server}
				/>
			</div>
		</div>
	);
}
