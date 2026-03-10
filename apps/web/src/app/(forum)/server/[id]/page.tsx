import { getAllThreads } from "@repo/db/helpers/servers";
import { FrontPageSidebar } from "@/components/forum/shell";
import { ThreadList } from "@/components/forum/thread-list";
import { getAllThreadsCached, getServerInfoCached } from "@/utils/cache";
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

	const server = await getServerInfoCached(id);

	if (!server) {
		return {
			title: "Server Not Found",
			openGraph: {
				title: "Server Not Found",
			},
		};
	}
	return {
		title: server.name,
		description: server.description ?? undefined,
		alternates: {
			canonical: getMainSiteUrl(`/server/${id}`),
		},
		openGraph: {
			title: server.name,
			description: server.description,
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
	const { id } = await params;

	const searchParamsPage = await parseForumPage(searchParams);

	const server = await getServerInfoCached(id);

	if (!server) {
		return <div>Server doesn't exist</div>;
	}

	if (hasVerifiedCustomDomain(server)) {
		permanentRedirect(getCustomDomainUrl(server, "/"));
	}

	const { threads, hasMore, page } = await getAllThreadsCached("server", {
		id,
		pinFilter: "all",
		page: searchParamsPage,
	});

	return (
		<div className="mx-auto p-4">
			<h2 className="mb-6 max-w-4xl text-balance font-medium text-3xl tracking-tight lg:text-4xl">
				Join a Discussion
			</h2>
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
