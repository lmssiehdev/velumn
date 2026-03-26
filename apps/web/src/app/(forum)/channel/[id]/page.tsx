import { notFound, permanentRedirect } from "next/navigation";
import { FrontPageSidebar } from "@/components/forum/shell";
import { ThreadList } from "@/components/forum/thread-list";
import {
	getCustomDomainUrl,
	getMainSiteUrl,
	hasVerifiedCustomDomain,
} from "@/lib/domains";
import { buildPageMetadata, toDescription } from "@/lib/seo";
import { getAllThreadsCached, getChannelInfoCached } from "@/utils/cache";
import { type ForumSearchParams, parseForumPage } from "../../_lib/pagination";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	const channel = await getChannelInfoCached(id);

	if (!channel) {
		return {
			title: "Channel not found",
			robots: {
				index: false,
				follow: false,
			},
		};
	}
	return buildPageMetadata({
		title: `${channel.channelName} Discord Channel`,
		description:
			toDescription(channel.server?.description) ??
			`Browse indexed Discord discussions from the ${channel.channelName} channel.`,
		canonicalUrl: getMainSiteUrl(`/channel/${id}`),
	});
}

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<ForumSearchParams>;
}) {
	const { id: channelId } = await params;
	const resolvedSearchParams = await searchParams;
	// !! TODO: do these in one join
	const channel = await getChannelInfoCached(channelId);
	const searchParamsPage = await parseForumPage(resolvedSearchParams);

	if (!channel?.server) {
		notFound();
	}

	if (hasVerifiedCustomDomain(channel.server)) {
		const pageParam = Array.isArray(resolvedSearchParams.page)
			? resolvedSearchParams.page[0]
			: resolvedSearchParams.page;
		const redirectPath = pageParam
			? `/channel/${channelId}?page=${pageParam}`
			: `/channel/${channelId}`;
		permanentRedirect(getCustomDomainUrl(channel.server, redirectPath));
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
			<h1 className="mb-6 max-w-4xl text-balance font-medium text-3xl tracking-tight lg:text-4xl">
				Join a Discussion
			</h1>
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
