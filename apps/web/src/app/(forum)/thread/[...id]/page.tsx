import { Attachments } from "@/components/markdown/attachments";
import { DiscordMarkdown } from "@/components/markdown/renderer";
import { DiscordIcon } from "@/components/misc";
import ThreadFeedback from "@/components/thread-feedback";
import { Button, buttonVariants } from "@/components/ui/button";
import { getAllMessagesInThreadsCache, getServerInfoByChannelIdCache } from "@/utils/cache";
import {
  CaretRightIcon,
  ChatIcon,
  ChatsCircleIcon,
  DetectiveIcon,
  HashIcon,
  ImageIcon,
} from "@phosphor-icons/react/dist/ssr";
import { getAllMessagesInThreads } from "@repo/db/helpers/channels";
import { snowflakeToReadableDate } from "@repo/utils/helpers/time";
import Link from "next/link";
import { ServerInfo } from "../../layout";
import { JsonLd } from "react-schemaorg";
import { DiscussionForumPosting, WithContext } from "schema-dts";
import { getDateFromSnowflake, isSnowflakeLargerAsInt } from "@repo/utils/helpers/snowflake";
import { sanitizeJsonLd } from "@/utils/sanitize";
import { redirect } from "next/navigation";
import { getSlugFromTitle, slugifyThreadUrl } from "@/lib/slugify";
import { isEmbeddableAttachment } from "@repo/utils/helpers/misc";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { adjectives, nouns, uniqueUsernameGenerator } from "unique-username-generator";
import { DBMessage, DBUser } from "@repo/db/schema/discord";
import { cn } from "@/lib/utils";
import { ChannelType } from "discord-api-types/v10";
import { Embeds } from "@/components/markdown/embed";
import { Twemoji } from "@/components/markdown/emoji";
export async function generateMetadata({ params }: { params: Promise<{ id: [string, string?] }> }) {
  const {
    id: [threadId],
  } = await params;

  const thread = await getAllMessagesInThreadsCache(threadId);

  if (!thread || !thread.messages || thread.messages.length === 0) {
    return {
      title: "Not Found",
      openGraph: {
        title: "Not Found",
        description: "Thread not found",
      },
    };
  }

  const url = slugifyThreadUrl({ id: threadId, name: thread.channelName! });
  if (!thread || !thread.messages) {
    return {
      title: "Thread Not Found",
      openGraph: {
        title: "Not Found",
        description: "Thread not found",
        url,
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
  };
}

export default async function Page({ params }: { params: Promise<{ id: [string, string?] }> }) {
  const {
    id: [threadId, slug],
  } = await params;

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
  const dateModified = thread.messages
    .map((m) => m.id)
    .reduce((snowflake, snowflake2) => {
      return BigInt(snowflake) > BigInt(snowflake2) ? snowflake : snowflake2;
    });

  const messagesLookup = new Map<string, MessageWithMetadata>(
    thread.messages.map((x) => [x.id, x]),
  );

  return (
    <div>
      <JsonLd<DiscussionForumPosting>
        item={sanitizeJsonLd<WithContext<DiscussionForumPosting>>({
          "@context": "https://schema.org",
          "@type": "DiscussionForumPosting",
          // !! TODO: non relative url
          url: `/thread/${threadId}`,
          datePublished: getDateFromSnowflake(thread.id).toISOString(),
          dateModified: getDateFromSnowflake(dateModified).toISOString(),
          author: {
            "@type": "Person",
            name: anonymizeName(op),
            url: undefined,
            identifier: op.anonymizeName ? anonymizeName(op!) : op?.id,
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
              name: anonymizeName(m.user!),
              url: undefined,
              identifier: m.user?.anonymizeName ? anonymizeName(m.user!) : m.user?.id,
            },
          })),
        })}
      />
      <div>
        <div className="my-6 px-3">
          <h1 className="my-2 text-balance font-medium tracking-tight text-3xl lg:text-4xl max-w-4xl ">
            {thread.channelName}
          </h1>
          <Link
            href={`/channel/${thread.parentId}`}
            className=" w-fit flex items-center gap-1 text-sm border-1 px-2 py-0.5 border-purple-700 hover:bg-purple-700 hover:text-white transition-all text-purple-700"
          >
            {thread.type === ChannelType.GuildForum ? (
              <ChatsCircleIcon className="size-3.5" />
            ) : (
              <HashIcon className="size-3.5" weight="bold" />
            )}
            General
          </Link>
        </div>
      </div>
      <div className="overflow-hidden md:flex-row flex-col flex gap-6">
        <div className="flex-1 overflow-hidden">
          {originalPost != undefined && (
            <MessagePost
              key={originalPost?.id}
              message={originalPost!}
              authorId={authorId!}
              isOriginalPost={true}
            />
          )}
          <div className="px-3 my-4 flex gap-2 items-center">
            <ChatIcon className="size-5" />
            <span className="text-sm">{orderedMessages.length} Replies</span>
          </div>
          <div className="space-y-2">
            {orderedMessages.map((message) => {
              return (
                <MessagePost
                  key={message.id}
                  referenceMessage={messagesLookup.get(message.referenceId!)}
                  message={message}
                  authorId={authorId!}
                />
              );
            })}
          </div>
          {orderedMessages.length === 0 && op.id === authorId && <NoReplies />}
          {orderedMessages.length !== 0 && <ContinueDiscussion />}
        </div>
        <div className="max-w-xs w-full space-y-6 hidden md:block">
          <ServerInfo server={server} />
          <ThreadFeedback />
        </div>
      </div>
    </div>
  );
}

type MessageWithMetadata = NonNullable<
  Awaited<ReturnType<typeof getAllMessagesInThreads>>
>["messages"][number];
function MessagePost({
  message,
  authorId,
  referenceMessage,
  isOriginalPost = false,
}: {
  message: MessageWithMetadata;
  authorId: string;
  referenceMessage?: MessageWithMetadata;
  isOriginalPost?: boolean;
}) {
  const authorName = anonymizeName(message.user!);
  return (
    <div
      key={message.id}
      id={message.id}
      className={cn("p-3", { "border border-neutral-200": !isOriginalPost })}
    >
      {message.referenceId && <ReferenceMessage message={referenceMessage!} />}
      <div className="flex gap-2">
        <div className="flex items-center flex-col w-[50px]">
          <DiscordIcon />
        </div>
        <div className="flex-1 ">
          <div>
            <div className="flex items-center mb-1">
              <div className="flex gap-1 items-center font-medium">
                <span className="text-sm font-medium">{authorName}</span>
                {message.user?.id === authorId && (
                  <span className="text-xs border-1 px-1 border-purple-700 text-purple-700">
                    OP
                  </span>
                )}
                {message.user?.anonymizeName && (
                  <span className="text-xs px-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DetectiveIcon className="size-5" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>User prefers to remain anonymous</p>
                      </TooltipContent>
                    </Tooltip>
                  </span>
                )}
                {message.user?.isBot && <span className="text-xs rounded border-1 px-1 ">BOT</span>}
              </div>
              <div className="text-sm text-neutral-500 transition-colors hover:text-neutral-800">
                <span className="mx-1">•</span>
                <span className="text-xs">{snowflakeToReadableDate(message.id)}</span>
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
            <DiscordMarkdown metadata={message.metadata}>{message.content}</DiscordMarkdown>
            <Attachments attachments={message.attachments!} />
            <Embeds embeds={message.embeds} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ReferenceMessage({ message }: { message: MessageWithMetadata }) {
  const user = message?.user!;

  if (!message?.content && !message?.attachments.length) {
    return;
  }

  return (
    <div className="ml-2 flex items-center">
      <div className="w-[50px] flex flex-col items-end justify-end">
        <ReferenceLinkIcon className="size-8" />
      </div>
      {message ? (
        <Link href={`#${message.id}`} className="whitespace-nowrap text-ellipsis overflow-hidden">
          <span className="text-sm font-semibold">{`@${user.displayName}`}</span>
          <span className="[&_*]:!text-xs [&_*]:!inline [&_*]:!m-0 [&_*]:!p-[1px]">
            {!message?.content ? (
              <span className="text-sm italic">
                Click to see attachments <ImageIcon className="size-5" />{" "}
              </span>
            ) : (
              <DiscordMarkdown metadata={message.metadata} isReferenceReply={true}>
                {message.content.substring(0, 150)}
              </DiscordMarkdown>
            )}
          </span>
        </Link>
      ) : (
        <span className="text-sm italic">Original message was deleted</span>
      )}
    </div>
  );
}

function NoReplies() {
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
  );
}

function ContinueDiscussion() {
  return (
    <div className="mt-2 rounded-lg border border-neutral-200 p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className=" flex justify-between items-center">
        <div className="flex gap-2 items-center">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center">
            <Twemoji name="💬" className="size-7" />
          </div>
          <h3 className="mb-1 text-lg font-semibold text-neutral-900">Continue the Discussion</h3>
        </div>
        <a
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({
            variant: "outline",
            class: "group",
          })}
        >
          Open in Discord{" "}
          <CaretRightIcon className="transition-transform duration-300 group-hover:translate-x-0.5" />
        </a>
      </div>
    </div>
  );
}

export function anonymizeName(user: DBUser) {
  if (!user.anonymizeName) {
    return user.displayName;
  }
  return uniqueUsernameGenerator({
    dictionaries: [adjectives, nouns],
    seed: user.id,
    style: "lowerCase",
  });
}

function ReferenceLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      width="21"
      height="4"
      fill="none"
      aria-label="Reply Spline"
      className={cn("inline-block shrink-0 text-current", className)}
      viewBox="0 0 21 4"
    >
      <path stroke="#72767D" d="M1 9V6a5 5 0 0 1 5-5h12"></path>
    </svg>
  );
}
