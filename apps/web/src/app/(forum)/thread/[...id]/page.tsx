import { Attachments } from "@/components/markdown/attachments";
import { DiscordMarkdown, Twemoji } from "@/components/markdown/renderer";
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
import { JsonLd } from 'react-schemaorg';
import { DiscussionForumPosting, WithContext } from 'schema-dts';
import { getDateFromSnowflake, isSnowflakeLargerAsInt } from "@repo/utils/helpers/snowflake";
import { sanitizeJsonLd } from "@/utils/sanitize";
import { redirect } from "next/navigation";
import { getSlugFromTitle, slugifyThreadUrl } from "@/lib/slugify";
import { isEmbeddableAttachment } from "@repo/utils/helpers/misc";

export async function generateMetadata({ params }: { params: Promise<{ id: [string, string?] }> }) {
  const { id: [threadId] } = await params;

  const thread = await getAllMessagesInThreadsCache(threadId);

  if (!thread || !thread.messages || thread.messages.length === 0) {
    return {
      title: 'Not Found',
      openGraph: {
        title: 'Not Found',
        description: 'Thread not found',
      },
    };
  }

  const url = slugifyThreadUrl({ id: threadId, name: thread.channelName! });
  if (!thread || !thread.messages) {
    return {
      title: 'Thread Not Found',
      openGraph: {
        title: 'Not Found',
        description: 'Thread not found',
        url
      },
    };
  }
  return {
    title: thread.channelName,
    // TODO: check for answer first then fallback to original post
    description: thread.messages[0]?.content.slice(0, 300),
    alternates: {
      canonical: url,
    },
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: [string, string?] }>;
}) {
  const { id: [threadId, slug] } = await params;


  if (!threadId) {
    return <div>Thread doesn't exist</div>;
  }

  const thread = await getAllMessagesInThreadsCache(threadId);

  if (!thread) {
    return <div>Thread doesn't exist</div>;
  }

  if (!slug || slug !== getSlugFromTitle(thread.channelName!)) {
    redirect(slugifyThreadUrl({ id: threadId, name: thread.channelName! }));
  }

  const [originalPost, ...orderedMessages] = thread.messages;

  if (!originalPost) {
    return <div>Thread doesn't exist</div>;
  }

  const server = await getServerInfoByChannelIdCache(threadId);

  const op = originalPost.user!;
  const title = thread.channelName ?? originalPost.content!.slice(0, 100);
  const firstImage = originalPost.attachments.filter(isEmbeddableAttachment).at(0);

  // TODO: handle empty messages;
  const authorId = thread.messages[0]?.user?.id;
  const dateModified = thread.messages.map(m => m.id).reduce((snowflake, snowflake2) => {
    return BigInt(snowflake) > BigInt(snowflake2) ? snowflake : snowflake2;
  })
  return (
    <div>
      <JsonLd<DiscussionForumPosting>
        item={sanitizeJsonLd<WithContext<DiscussionForumPosting>>({
          "@context": "https://schema.org",
          "@type": "DiscussionForumPosting",
          // !! TODO: non relative url
          "url": `/thread/${threadId}`,
          datePublished: getDateFromSnowflake(thread.id).toISOString(),
          dateModified: getDateFromSnowflake(dateModified).toISOString(),
          author: {
            "@type": "Person",
            name: op.displayName,
            url: undefined,
            identifier: op.id
          },
          // todo fall to an og?
          image: firstImage?.proxyUrl || undefined,
          headline: title,
          articleBody: originalPost.content,
          identifier: thread.id,
          commentCount: orderedMessages.length,
          comment: orderedMessages.map((m, idx) => ({
            "@type": "Comment",
            text: m.content,
            identifier: m.id,
            // TODO: add parentItem
            datePublished: getDateFromSnowflake(m.id).toISOString(),
            position: idx + 1,
            author: {
              "@type": "Person",
              name: m.user?.displayName,
              url: undefined,
              identifier: m.user?.id
            }
          }))
        })}
      />
      <div>
        <h1 className=" text-balance text-2xl sm:text-xl font-medium tracking-tight md:text-3xl lg:text-4xl max-w-4xl mb-6 px-3">{thread.channelName}</h1>
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
          {orderedMessages.length === 0 && op.id === authorId && <NoReplies />}
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
          {/* TODO: Borken ID, don't use relations */}
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