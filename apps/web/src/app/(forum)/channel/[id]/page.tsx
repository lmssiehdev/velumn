import { ThreadList } from "@/app/(forum)/server/[id]/page";
import { getAllThreadsCached, getChannelInfoCached } from "@/utils/cache";
import { FrontPageSidebar } from "../../layout";

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
		// TODO: sync description?
		// describe: channel?.description,
		openGraph: {
			title: channel?.channelName,
			// description: channel?.description,
		},
	};
}

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: { page: string };
}) {
	const { id: channelId } = await params;
	// !! TODO: do these in one join
	const channel = await getChannelInfoCached(channelId);
	const searchParamsPage = Number((await searchParams).page ?? 1);

	if (!channel?.server) {
		return <div>Channel doesn't exist</div>;
	}

	const [regularResult, pinnedResult] = await Promise.all([
		getAllThreadsCached("channel", {
			id: channelId,
			page: searchParamsPage,
		}),
		getAllThreadsCached("channel", {
			id: channelId,
			pinned: true,
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
					page={page}
					serverId={channelId}
					threads={threads.concat(pinnedThread)}
				/>
				<FrontPageSidebar
					activeChannelId={channel.id}
					server={channel.server}
				/>
			</div>
		</div>
	);
}
