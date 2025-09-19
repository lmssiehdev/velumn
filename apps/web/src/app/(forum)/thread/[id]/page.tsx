import { Attachments } from "@/components/markdown-renderer/attachments";
import { DiscordMarkdown, Twemoji } from "@/components/markdown-renderer/markdown-renderer";
import { DiscordIcon } from "@/components/misc";
import ThreadFeedback from "@/components/thread-feedback";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getAllMessagesInThreadsCache, getServerInfoByChannelIdCache } from "@/utils/cache";
import { ChatIcon } from "@phosphor-icons/react/dist/ssr";
import { getAllMessagesInThreads } from "@repo/db/helpers/channels";
import { snowflakeToReadableDate } from "@repo/utils/helpers/time";
import Link from "next/link";
import { ServerInfo } from "../../layout";


export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getAllMessagesInThreadsCache(id);

if (!post || !post.messages) {
    return {
      title: 'Not Found',
      openGraph: {
        title: 'Not Found',
        description: 'Thread not found',
      },
    };
  }
  return {
    title: post.channelName,
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!id) {
    return <div>Channel doesn't exist</div>;
  }

  const channel = await getAllMessagesInThreadsCache(id);
  const server = await getServerInfoByChannelIdCache(id);

  if (!channel) {
    return <div>Channel doesn't exist</div>;
  }

  // TODO: do this in the query;
  const [originalPost, ...orderedMessages] = channel.messages;

  // TODO: handle empty messages;
  const authorId = channel.messages[0]?.user?.id;

  return (
    <div>
      <div className="">
        <h1 className=" text-balance text-2xl sm:text-xl font-medium tracking-tight md:text-3xl lg:text-4xl max-w-4xl mb-6 px-3">{channel.channelName}</h1>
      </div>
      <div className="flex gap-6">
        <div className="flex-1">
          {originalPost != undefined && <MessagePost key={originalPost?.id} message={originalPost!} authorId={authorId!} />
          }
          <div className="px-3 my-3 flex gap-2 items-center">
              <ChatIcon className="size-5" />
              <span className="text-sm">
                  {orderedMessages.length} Replies
              </span>
          </div>
          <Separator className="my-4" />
          {orderedMessages.map((message) => {
            return (
              <div className="py-3" key={message.id}>
                <MessagePost message={message} authorId={authorId!} />
                </div>
            )
          })}
          {orderedMessages.length === 0 && originalPost?.user?.id === authorId && <NoReplies />}
        </div>
        <div className="max-w-xs w-full space-y-6">
          <ServerInfo server={server} />
          <ThreadFeedback />
        </div>
      </div>
    </div>
  );
}

function MessagePost({ message, authorId }: {
  message: NonNullable<Awaited<ReturnType<typeof getAllMessagesInThreads>>>["messages"][number],
  authorId: string,
}) {
  return (
    <div key={message.id} className="flex gap-4 px-3 max-w-screen-md">
      <div className="flex pt-1">
        <DiscordIcon />
      </div>
      <div className="flex-1 ">
        <div>
          <div className="flex items-center mb-1">
            <div className="flex gap-1 items-center font-medium">
              <span className="text-sm font-medium">
                {message.user?.displayName}
              </span>
              {message.user?.id === authorId && (
                <span className="text-xs border-1 px-1 border-purple-700 text-purple-700">
                  OP
                </span>
              )}
              {message.user?.isBot && (
                <span className="text-xs rounded border-1 px-1 ">
                  BOT
                </span>
              )}
            </div>
            <div className="text-sm text-neutral-500 transition-colors hover:text-neutral-800">
              <span className="mx-1">•</span>
              <span className="text-xs">
                {snowflakeToReadableDate(message.id)}
              </span>
            </div>
            {false && message.referenceId && (
              <Button asChild size={"sm"} variant={"link"}>
                <Link
                  href={`#${message.referenceId}`}
                  className="hover:underline underline-offset-2"
                >
                            // reply
                </Link>
              </Button>
            )}
          </div>
        </div>
        <div>
          <DiscordMarkdown>{message.content}</DiscordMarkdown>
          {/* Borken ID, don't use relations */}
          <Attachments attachments={message.attachments!} />
        </div>
      </div>
    </div>

  )
}

export function NoReplies() {
  return (
    <div className="p-4 rounded-lg border border-neutral-200 mt-4">
      <div className="flex gap-2">
        <div className="w-12 h-12 flex items-center justify-center mx-auto mb-3">
          <Twemoji name="💬" className="size-10" />
        </div>
        <div className="flex-1">
          <h5 className="font-semibold text-neutral-800 mb-1">Start the conversation!</h5>
          <p className="text-neutral-700 mb-6">Be the first to share what you think!</p>
        </div>
      </div>

      <Button className="w-full bg-purple-100 hover:bg-purple-200 text-purple-900/80 transition-colors">
        Reply to this thread
      </Button>
    </div>
  )
}