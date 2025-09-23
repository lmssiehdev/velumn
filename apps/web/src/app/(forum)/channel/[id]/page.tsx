import { ThreadList } from "@/app/(forum)/server/[id]/page";
import { getChannelInfo } from "@repo/db/helpers/channels";
import { getAllThreads } from "@repo/db/helpers/servers";
import { FrontPageSidebar } from "../../layout";

export default async function Page({
    params,
    searchParams
}: {
    params: Promise<{ id: string }>
    searchParams: { page: string }
}) {
    const { id: channelId } = await params;
    const data = await getChannelInfo(channelId);
    const searchParamsPage = Number(searchParams.page ?? 1);


    if (!data) {
        return <div>Channel doesn't exist</div>
    };

    // TODO: is channel needed here?
    const { channel, server } = data;

    const { threads, hasMore, page } = await getAllThreads("channel", channelId, searchParamsPage);

    return <div className="p-4 mx-auto">
        <h2 className=" text-balance text-2xl sm:text-xl font-medium tracking-tight md:text-3xl lg:text-4xl max-w-4xl mb-6">
            Join a Discussion
        </h2>
        <div className="flex gap-6">
            <ThreadList serverId={channelId} threads={threads} page={page} hasMore={hasMore} />
            <FrontPageSidebar server={server} activeChannelId={channel.id} />
        </div>
    </div>
}