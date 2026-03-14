import { FrontPageSidebar } from "@/components/forum/shell";
import { ThreadList } from "@/components/forum/thread-list";
import { getCustomDomainUrl } from "@/lib/domains";
import { buildPageMetadata, toDescription } from "@/lib/seo";
import { getAllThreadsCached } from "@/utils/cache";
import {
	type ForumSearchParams,
	parseForumPage,
} from "../(forum)/_lib/pagination";
import { getTenantServerOrNotFound } from "./_lib/tenant";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ domain: string }>;
}) {
	const { domain } = await params;
	const { server } = await getTenantServerOrNotFound(domain);

	return buildPageMetadata({
		title: `${server.name} Discord Discussions`,
		description:
			toDescription(server.description) ??
			`Browse indexed Discord discussions, support threads, and community answers from ${server.name}.`,
		canonicalUrl: getCustomDomainUrl(server, "/"),
	});
}

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ domain: string }>;
	searchParams: Promise<ForumSearchParams>;
}) {
	const { domain } = await params;
	const { server } = await getTenantServerOrNotFound(domain);
	const searchParamsPage = await parseForumPage(searchParams);

	const { threads, hasMore, page } = await getAllThreadsCached("server", {
		id: server.id,
		pinFilter: "all",
		page: searchParamsPage,
	});

	return (
		<div className="mx-auto p-4">
			<h1 className="mb-6 max-w-4xl text-balance font-medium text-3xl tracking-tight lg:text-4xl">
				Join a Discussion
			</h1>
			<div className="flex gap-6">
				<ThreadList
					hasMore={hasMore}
					hrefBase="/"
					page={page}
					threads={threads}
				/>
				<FrontPageSidebar homeHref="/" server={server} />
			</div>
		</div>
	);
}
