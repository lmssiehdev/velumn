import {
  CaretRightIcon,
  ChatIcon,
  ChatsCircleIcon,
  DetectiveIcon,
  HashIcon,
  ImageIcon,
} from '@phosphor-icons/react/dist/ssr';
import type { getAllMessagesInThreads } from '@repo/db/helpers/channels';
import type { DBUser } from '@repo/db/schema/discord';
import { isEmbeddableAttachment } from '@repo/utils/helpers/misc';
import { getDateFromSnowflake } from '@repo/utils/helpers/snowflake';
import { snowflakeToReadableDate } from '@repo/utils/helpers/time';
import { ChannelType } from 'discord-api-types/v10';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { JsonLd } from 'react-schemaorg';
import type { DiscussionForumPosting, WithContext } from 'schema-dts';
import {
  adjectives,
  nouns,
  uniqueUsernameGenerator,
} from 'unique-username-generator';
import { Twemoji } from '@/components/markdown/emoji';
import { ThreadIcon } from '@/components/markdown/mention';
import {
  DiscordMarkdown,
  DiscordMessageWithMetadata,
} from '@/components/markdown/renderer';
import { DiscordIcon } from '@/components/misc';
import ThreadFeedback from '@/components/thread-feedback';
import { Button } from '@/components/ui/button';
import { rainbowButtonVariants } from '@/components/ui/rainbow-button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getSlugFromTitle, slugifyThreadUrl } from '@/lib/slugify';
import { cn } from '@/lib/utils';
import {
  getAllMessagesInThreadsCache,
  getServerInfoByChannelIdCache,
} from '@/utils/cache';
import { sanitizeJsonLd } from '@/utils/sanitize';
import { ServerInfo } from '../../layout';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: [string, string?] }>;
}) {
  const {
    id: [threadId],
  } = await params;

  const thread = await getAllMessagesInThreadsCache(threadId);

  if (!thread || !thread.messages || thread.messages.length === 0) {
    return {
      title: 'Not Found',
      openGraph: {
        title: 'Not Found',
        description: 'Thread not found',
        images: [`/og?id=${threadId}`],
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
        url,
        images: [`/og?id=${threadId}`],
      },
    };
  }
  return {
    title: thread.channelName,
    // TODO: check for answer first then fallback to original post
    openGraph: {
      title: thread.channelName,
      description: thread.messages[0]?.cleanContent?.slice(0, 300),
      // TODO:
      // description: "Thread not found",
      url,
      images: [`/og?id=${threadId}`],
    },
    alternates: {
      canonical: url,
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: [string, string?] }>;
}) {
  const {
    id: [threadId, slug],
  } = await params;

  if (!threadId) {
    return <div>Thread doesn't exist</div>;
  }

  const thread = await getAllMessagesInThreadsCache(threadId);

  console.log({ thread });

  if (!thread || !thread.server) {
    return <div>Thread doesn't exist</div>;
  }

  if (!slug || slug !== getSlugFromTitle(thread.channelName!)) {
    redirect(slugifyThreadUrl({ id: threadId, name: thread.channelName! }));
  }

  const server = thread.server;

  const [originalPost, ...orderedMessages] = thread.messages;

  const items = [
    ...orderedMessages.map((msg) => ({ type: 'message' as const, data: msg })),
    ...thread.backlinks.map((backlink) => ({
      type: 'backlink' as const,
      data: {
        id: backlink.fromMessageId,
        ...backlink,
      },
    })),
  ].sort((a, b) => a.data.id.localeCompare(b.data.id));

  if (!originalPost) {
    return <div>Thread doesn't exist</div>;
  }

  const op = originalPost.user!;
  const title = thread.channelName ?? originalPost.content!.slice(0, 100);
  const firstImage = originalPost.attachments
    .filter(isEmbeddableAttachment)
    .at(0);

  // TODO: handle empty messages;
  const authorId = thread.messages[0]?.user?.id;
  const dateModified = thread.messages
    .map((m) => m.id)
    .reduce((snowflake, snowflake2) => {
      return BigInt(snowflake) > BigInt(snowflake2) ? snowflake : snowflake2;
    });

  const messagesLookup = new Map<string, MessageWithMetadata>(
    thread.messages.map((x) => [x.id, x])
  );

  return (
    <div>
      <JsonLd<DiscussionForumPosting>
        item={sanitizeJsonLd<WithContext<DiscussionForumPosting>>({
          '@context': 'https://schema.org',
          '@type': 'DiscussionForumPosting',
          // !! TODO: non relative url
          url: `/thread/${threadId}`,
          datePublished: getDateFromSnowflake(thread.id).toISOString(),
          dateModified: getDateFromSnowflake(dateModified).toISOString(),
          author: {
            '@type': 'Person',
            name: anonymizeName(op),
            url: undefined,
            identifier: op.anonymizeName ? anonymizeName(op!) : op?.id,
          },
          // todo fall to an og?
          image: firstImage?.proxyURL || undefined,
          headline: title,
          articleBody: originalPost.content,
          identifier: thread.id,
          commentCount: orderedMessages.length,
          comment: orderedMessages.map((m, idx) => ({
            '@type': 'Comment',
            text: m.content,
            identifier: m.id,
            // TODO: add parentItem
            datePublished: getDateFromSnowflake(m.id).toISOString(),
            position: idx + 1,
            author: {
              '@type': 'Person',
              name: anonymizeName(m.user!),
              url: undefined,
              identifier: m.user?.anonymizeName
                ? anonymizeName(m.user!)
                : m.user?.id,
            },
          })),
        })}
      />
      <div>
        <div className="my-6 px-3">
          <h1 className="my-2 max-w-4xl text-balance font-medium text-3xl tracking-tight lg:text-4xl">
            {thread.channelName}
          </h1>
          <Link
            className="flex w-fit items-center gap-1 border-1 border-purple-600 px-2 py-0.5 text-purple-600 text-sm transition-all hover:bg-purple-600 hover:text-white"
            href={`/channel/${thread.parentId}`}
          >
            {thread.parent?.type === ChannelType.GuildForum ? (
              <ChatsCircleIcon className="size-3.5" />
            ) : (
              <HashIcon className="size-3.5" weight="bold" />
            )}
            {thread.parent?.channelName}
          </Link>
        </div>
      </div>
      <div className="flex flex-col gap-6 overflow-hidden md:flex-row">
        <div className="flex-1 overflow-hidden">
          {originalPost != undefined && (
            <MessagePost
              authorId={authorId!}
              isOriginalPost={true}
              key={originalPost?.id}
              message={originalPost!}
            />
          )}
          <div className="my-4 flex items-center gap-2 px-3">
            <ChatIcon className="size-5" />
            <span className="text-sm">{orderedMessages.length} Replies</span>
          </div>
          <div className="space-y-2">
            {items.map((item) => {
              if (item.type === 'message') {
                return (
                  <MessagePost
                    authorId={authorId!}
                    key={item.data.id}
                    message={item.data}
                    referenceMessage={messagesLookup.get(
                      item.data.referenceId!
                    )}
                  />
                );
              }
              return (
                <a
                  className="block space-x-1.5 px-3 align-baseline text-neutral-700 text-sm"
                  href={`/thread/${item.data.fromThreadId}/#${item.data.fromMessageId}`}
                  key={item.data.id}
                >
                  <div className="inline-block space-x-1">
                    <ThreadIcon className="inline-block size-4" />
                    <div className="inline-block space-x-1 align-baseline">
                      <span className="font-semibold">
                        @{anonymizeName(item.data.fromThread?.author!)}
                      </span>
                      <span>{item.data.fromThread?.channelName}</span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
          <ContinueDiscussion
            noReplies={orderedMessages.length === 0}
            url={ConstructDiscordLink({
              serverId: server.id,
              threadId: thread.id,
            })}
          />
        </div>
        <div className="hidden w-full max-w-xs space-y-6 md:block">
          <ServerInfo server={server} />
          <ThreadFeedback />
        </div>
      </div>
    </div>
  );
}

function ConstructDiscordLink({
  serverId,
  threadId,
  messageId,
}: {
  serverId: string;
  threadId: string;
  messageId?: string;
}) {
  const parts = [serverId, threadId];

  if (messageId) {
    parts.push(messageId);
  }

  return `https://discord.com/channels/${parts.join('/')}`;
}

type MessageWithMetadata = NonNullable<
  Awaited<ReturnType<typeof getAllMessagesInThreads>>
>['messages'][number];
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
      className={cn('p-3', { 'border border-neutral-200': !isOriginalPost })}
      id={message.id}
      key={message.id}
    >
      {message.referenceId && <ReferenceMessage message={referenceMessage!} />}
      <div className="flex gap-2">
        <div className="flex w-[50px] flex-col items-center">
          <DiscordIcon />
        </div>
        <div className="flex-1">
          <div>
            <div className="mb-1 flex items-center">
              <div className="flex items-center gap-1 font-medium">
                <span className="font-medium text-sm">{authorName}</span>
                {message.user?.id === authorId && (
                  <span className="border-1 border-purple-700 px-1 text-purple-700 text-xs">
                    OP
                  </span>
                )}
                {message.user?.anonymizeName && (
                  <span className="px-1 text-xs">
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
                {message.user?.isBot && (
                  <span className="rounded border-1 px-1 text-xs">BOT</span>
                )}
              </div>
              <div className="text-neutral-500 text-sm transition-colors hover:text-neutral-800">
                <span className="mx-1">•</span>
                <span className="text-xs">
                  {snowflakeToReadableDate(message.id)}
                </span>
              </div>
              {false && message.referenceId && (
                <Button asChild size={'sm'} variant={'link'}>
                  <Link
                    className="underline-offset-2 hover:underline"
                    href={`#${message.referenceId}`}
                  >
                    // reply
                  </Link>
                </Button>
              )}
            </div>
          </div>
          <div>
            {message.user?.isIgnored || message.isIgnored ? (
              <div>
                <p>
                  User prefers to remain anonymous, join the server to see this
                  message.
                </p>
              </div>
            ) : (
              <DiscordMessageWithMetadata message={message} />
            )}
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
      <div className="flex w-[50px] flex-col items-end justify-end">
        <ReferenceLinkIcon className="size-8" />
      </div>
      {message ? (
        <Link
          className="overflow-hidden text-ellipsis whitespace-nowrap"
          href={`#${message.id}`}
        >
          <span className="font-semibold text-sm">{`@${user.displayName}`}</span>
          <span className="[&_*]:!text-xs [&_*]:!inline [&_*]:!m-0 [&_*]:!p-[1px]">
            {message?.content ? (
              <DiscordMarkdown isReferenceReply={true} message={message}>
                {message.content.substring(0, 150)}
              </DiscordMarkdown>
            ) : (
              <span className="text-sm italic">
                Click to see attachments <ImageIcon className="size-5" />{' '}
              </span>
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
    <div className="mt-4 rounded-lg border border-neutral-200 p-4">
      <div className="flex gap-2">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center">
          <Twemoji className="size-10" name="💬" />
        </div>
        <div className="flex-1">
          <h5 className="mb-1 font-semibold text-neutral-800">
            Start the conversation!
          </h5>
          <p className="mb-6 text-neutral-700">
            Be the first to share what you think!
          </p>
        </div>
      </div>

      <Button className="w-full bg-purple-100 text-purple-900/80 transition-colors hover:bg-purple-200">
        Reply to this thread
      </Button>
    </div>
  );
}

function ContinueDiscussion({
  url,
  noReplies,
}: {
  url: string;
  noReplies: boolean;
}) {
  const icon = noReplies ? '👋' : '💬';
  return (
    <div className="mt-2 rounded-lg border border-neutral-200 p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center">
            <Twemoji className="size-7" name={icon} />
          </div>
          <div>
            {noReplies ? (
              <>
                <div className="font-semibold text-lg text-neutral-900">
                  Start the conversation!
                </div>
                <span className="text-neutral-700 text-sm">
                  Be the first to share what you think!
                </span>
              </>
            ) : (
              <div className="font-semibold text-lg text-neutral-900">
                Continue the Discussion
              </div>
            )}
          </div>
        </div>

        <a
          className={rainbowButtonVariants({
            variant: 'outline',
            class: 'group',
          })}
          href={url}
          rel="noopener noreferrer"
          target="_blank"
        >
          Open in Discord{' '}
          <CaretRightIcon className="transition-transform duration-300 group-hover:translate-x-0.5" />
        </a>
      </div>
    </div>
  );
}

export function anonymizeName(
  user: Pick<DBUser, 'id' | 'displayName' | 'anonymizeName' | 'isIgnored'>
) {
  if (!user) return 'Unknown';

  if (!user.anonymizeName && !user.isIgnored) {
    return user.displayName;
  }
  return uniqueUsernameGenerator({
    dictionaries: [adjectives, nouns],
    seed: user.id,
    style: 'lowerCase',
  });
}

function ReferenceLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-label="Reply Spline"
      className={cn('inline-block shrink-0 text-current', className)}
      fill="none"
      height="4"
      viewBox="0 0 21 4"
      width="21"
    >
      <path d="M1 9V6a5 5 0 0 1 5-5h12" stroke="#72767D" />
    </svg>
  );
}
