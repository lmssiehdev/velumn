import {
	type ForumSearchParams,
	parseForumPage,
} from "@/app/(forum)/_lib/pagination";
import { FrontPageSidebar } from "@/components/forum/shell";
import { ThreadList } from "@/components/forum/thread-list";
import { getCustomDomainUrl } from "@/lib/domains";
import { buildPageMetadata, toDescription } from "@/lib/seo";
import { getAllThreadsCached } from "@/utils/cache";
import { getTenantChannelOrNotFound } from "../../_lib/tenant";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ domain: string; id: string }>;
}) {
	const { domain, id } = await params;
	const { server, channel } = await getTenantChannelOrNotFound(domain, id);
	const canonicalUrl = getCustomDomainUrl(server, `/channel/${id}`);

	return buildPageMetadata({
		title: `${channel.channelName} Discord Channel`,
		description:
			toDescription(server.description) ??
			`Browse indexed Discord discussions from the ${channel.channelName} channel.`,
		canonicalUrl,
	});
}

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ domain: string; id: string }>;
	searchParams: Promise<ForumSearchParams>;
}) {
	const { domain, id: channelId } = await params;
	const { server, channel } = await getTenantChannelOrNotFound(
		domain,
		channelId,
	);
	const searchParamsPage = await parseForumPage(searchParams);

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
					homeHref="/"
					server={server}
				/>
			</div>
		</div>
	);
}
