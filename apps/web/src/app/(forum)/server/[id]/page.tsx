import { ChatIcon } from "@phosphor-icons/react/ssr";
import { getAllThreads, getServerInfo } from "@repo/db/helpers/servers";
import Link from "next/link";
import { FrontPageSidebar } from "../../layout";
import { snowflakeToReadableDate } from "@repo/utils/helpers/time";

export default async function Page({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params;

    const server = await getServerInfo(id);

    if (!server) {
        return <div>Server doesn't exist</div>
    };

    const threads = await getAllThreads("server", id);

    return <div className="p-4 mx-auto">
        <h2 className=" text-balance text-2xl sm:text-xl font-medium tracking-tight md:text-3xl lg:text-4xl max-w-4xl mb-6">
            Join a Discussion
        </h2>
        <div className="flex gap-6">
            <ThreadList threads={threads} />
            <FrontPageSidebar server={server} />
        </div>
    </div>
}

export function ThreadList({ threads }: { threads: Awaited<ReturnType<typeof getAllThreads>> }) {
    return (
        <div className="flex-1">
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
    )
}
