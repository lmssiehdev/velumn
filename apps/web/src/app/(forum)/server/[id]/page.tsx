import { getServerInfo } from "@repo/db/helpers/servers";
import { notFound, permanentRedirect } from "next/navigation";
import { FrontPageSidebar } from "@/components/forum/shell";
import { ThreadList } from "@/components/forum/thread-list";
import {
	getCustomDomainUrl,
	getMainSiteUrl,
	hasVerifiedCustomDomain,
} from "@/lib/domains";
import { buildPageMetadata, toDescription } from "@/lib/seo";
import { getAllThreadsCached } from "@/utils/cache";
import {
	buildPaginatedRedirectPath,
	type ForumSearchParams,
	parseForumPage,
} from "../../_lib/pagination";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	const server = await getServerInfo(id);

	if (!server) {
		return {
			title: "Server not found",
			robots: {
				index: false,
				follow: false,
			},
		};
	}
	return buildPageMetadata({
		title: `${server.name} Discord Discussions`,
		description:
			toDescription(server.description) ??
			`Browse indexed Discord discussions, support threads, and community answers from ${server.name}.`,
		canonicalUrl: getMainSiteUrl(`/server/${id}`),
	});
}

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<ForumSearchParams>;
}) {
	const { id } = await params;
	const resolvedSearchParams = await searchParams;

	const searchParamsPage = await parseForumPage(resolvedSearchParams);

	const server = await getServerInfo(id);

	if (!server) {
		notFound();
	}

	if (hasVerifiedCustomDomain(server)) {
		const redirectPath = buildPaginatedRedirectPath("/", searchParamsPage);
		permanentRedirect(getCustomDomainUrl(server, redirectPath));
	}

	const { threads, hasMore, page } = await getAllThreadsCached("server", {
		id,
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
					hrefBase={`/server/${id}`}
					page={page}
					threads={threads}
				/>
				<FrontPageSidebar homeHref={`/server/${id}`} server={server} />
			</div>
		</div>
	);
}
