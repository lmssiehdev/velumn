import { CaretLeftIcon, CaretRightIcon, ChatIcon, PushPinIcon } from "@phosphor-icons/react/ssr";
import { getAllThreads } from "@repo/db/helpers/servers";
import Link from "next/link";
import { FrontPageSidebar } from "../../layout";
import { snowflakeToReadableDate } from "@repo/utils/helpers/time";
import { Button } from "@/components/ui/button";
import { slugifyThreadUrl } from "@/lib/slugify";
import { anonymizeName } from "../../thread/[...id]/page";
import { getServerInfoCached } from "@/utils/cache";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
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
        describe: server.description,
        openGraph: {
            title: server.name,
            description: server.description,
        },
    };
}

export default async function Page({
    params,
    searchParams
}: {
    params: Promise<{ id: string }>,
    searchParams: { page: string }
}) {
    const { id } = await params;

    const searchParamsPage = Number(searchParams.page ?? 1);

    const server = await getServerInfoCached(id);

    if (!server) {
        return <div>Server doesn't exist</div>
    };

    const { threads, hasMore, page } = await getAllThreads("server", {
        id, page: searchParamsPage
    });

    return <div className="p-4 mx-auto">
        <h2 className=" text-balance font-medium tracking-tight text-3xl lg:text-4xl max-w-4xl mb-6">
            Join a Discussion
        </h2>
        <div className="flex gap-6">
            <ThreadList threads={threads} page={page} hasMore={hasMore} serverId={id} />
            <FrontPageSidebar server={server} />
        </div>
    </div>
}

type ThreadsData = Awaited<ReturnType<typeof getAllThreads>>;
export async function ThreadList({ threads, page, hasMore, serverId }: {
    serverId: string,
} & ThreadsData
) {
    if (threads.length === 0) {
        return <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-neutral-500 flex flex-col gap-2">
                No threads found
                {page > 1 &&
                    <Button variant={"secondary"} asChild>
                        <Link href={`/server/${serverId}`} className=" text-neutral-500 hover:underline underline-offset-2 flex items-center gap-2">
                            Clear Filters
                        </Link>
                    </Button>
                }
            </div>
        </div>
    }

    const {
        pinnedThread,
        otherThreads
    } = threads.reduce((acc, t) => {
        if (t.channel.pinned) {
            acc.pinnedThread = t;
            return acc;
        }
        acc.otherThreads.push(t);
        return acc;
    }, {
        pinnedThread: null as unknown as ThreadsData["threads"][number],
        otherThreads: [] as ThreadsData["threads"]
    });

    return (
        <div className="flex-1">
            <div>
                {
                    pinnedThread && (
                        <ThreadItem key={pinnedThread.channel.id} data={pinnedThread} />
                    )
                }
                {
                    otherThreads.map((thread) => {
                        return <ThreadItem key={thread.channel.id} data={thread} />
                    })
                }
            </div>
            <div className="flex items-center gap-4 justify-end mt-6">
                {page > 1 &&
                    <Button variant={"ghost"} asChild>
                        <Link href={`/server/${serverId}?page=${page - 1}`} className="text-sm text-neutral-700 flex items-center gap-2">
                            <CaretLeftIcon />
                            Prev
                        </Link>
                    </Button>
                }
                {hasMore &&
                    <Button variant={"ghost"} asChild>
                        <Link href={`/server/${serverId}?page=${page + 1}`} className="text-sm text-neutral-700 flex items-center gap-2">
                            Next
                            <CaretRightIcon />
                        </Link>
                    </Button>
                }
            </div>
        </div>
    )
}


export function ThreadItem({ data }: { data: ThreadsData["threads"][number] }) {
    const { channel, user, messagesCount, parentChannel } = data;
    const authorName = anonymizeName(user!)

    return <div className=" border-b py-4 border-neutral-300 rounded flex gap-4 items-center justify-between">
        <div>
            <div>
                <Link href={slugifyThreadUrl({ id: channel.id, name: channel.channelName! })} className="hover:underline underline-offset-2">
                    {channel.channelName}
                </Link>
                <div className="text-sm text-neutral-500">
                    by {authorName} • in <Link href={`/channel/${parentChannel?.id}`} className="hover:underline underline-offset-2">
                        #{parentChannel?.channelName}
                    </Link> • {snowflakeToReadableDate(channel.id)}
                </div>
            </div>
        </div>
        <div className="flex items-center gap-4">
            {channel.pinned && <PushPinIcon className="size-5" />}
            <div className="flex gap-2 items-center">
                <ChatIcon className="size-5" />
                <span className="text-sm">
                    {messagesCount - 1}
                </span>
            </div>
        </div>
    </div>
}
