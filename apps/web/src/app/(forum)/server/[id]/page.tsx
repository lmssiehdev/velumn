import { CaretLeftIcon, CaretRightIcon, ChatIcon } from "@phosphor-icons/react/ssr";
import { getAllThreads, getServerInfo } from "@repo/db/helpers/servers";
import Link from "next/link";
import { FrontPageSidebar } from "../../layout";
import { snowflakeToReadableDate } from "@repo/utils/helpers/time";
import { Button } from "@/components/ui/button";

export default async function Page({
    params,
    searchParams
}: {
    params: Promise<{ id: string }>,
    searchParams: { page: string }
}) {
    const { id } = await params;

    const searchParamsPage = Number(searchParams.page ?? 1);

    const server = await getServerInfo(id);

    if (!server) {
        return <div>Server doesn't exist</div>
    };

    const { threads, hasMore, page } = await getAllThreads("server", id, searchParamsPage);
    return <div className="p-4 mx-auto">
        <h2 className=" text-balance text-2xl sm:text-xl font-medium tracking-tight md:text-3xl lg:text-4xl max-w-4xl mb-6">
            Join a Discussion
        </h2>
        <div className="flex gap-6">
            <ThreadList threads={threads} page={page} hasMore={hasMore} serverId={id} />
            <FrontPageSidebar server={server} />
        </div>
    </div>
}

export function ThreadList({ threads, page, hasMore, serverId }: {
    serverId: string,
} & Awaited<ReturnType<typeof getAllThreads>>
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

    return (
        <div className="flex-1">
            <div>
                {
                    threads.map(({ channel, user, messagesCount, parentChannel }) => {
                        return <div key={channel.id} className=" border-b py-4 border-neutral-300 rounded flex gap-4 items-center justify-between">

                            <div>
                                <Link href={`/thread/${channel.id}`} className="hover:underline underline-offset-2">
                                    {channel.channelName}
                                </Link>
                                <div className="text-sm text-neutral-500">
                                    by {user.displayName ?? "Unknown"} • in <Link href={`/channel/${parentChannel?.id}`} className="hover:underline underline-offset-2">
                                        #{parentChannel?.channelName}
                                    </Link> • {snowflakeToReadableDate(channel.id)}
                                </div>
                            </div>
                            <div className="flex gap-2 items-center">
                                <ChatIcon className="size-5" />
                                <span className="text-sm">
                                    {messagesCount}
                                </span>
                            </div>
                        </div>
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
