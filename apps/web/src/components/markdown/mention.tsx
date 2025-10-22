import { ChatsCircleIcon, HashIcon } from '@phosphor-icons/react/dist/ssr';
import type { DBMessage } from '@repo/db/schema/discord';
import { ChannelType } from 'discord-api-types/v10';
import { cn } from '@/lib/utils';

type MentionType = 'channel' | 'role' | 'user';
type MentionProps = {
  type?: MentionType;
  message?: DBMessage;
  children: string;
};

const baseClassName =
  'inline-block mx-[0.5px] text-purple-800 bg-purple-100 rounded align-baseline';

export function Mention({ type, message, children }: MentionProps) {
  if (!type || !message?.metadata) {
    return <FallbackMention type={type}>{children}</FallbackMention>;
  }

  switch (type) {
    case 'channel':
      return <ChannelMention message={message}>{children}</ChannelMention>;
    case 'role':
      return <RoleMention message={message}>{children}</RoleMention>;
    case 'user':
      return <UserMention message={message}>{children}</UserMention>;
    default:
      return <FallbackMention type={type}>{children}</FallbackMention>;
  }
}

function ChannelMention({
  message,
  children,
}: {
  message: DBMessage;
  children: string;
}) {
  const channelData = message.metadata?.channels?.[children];

  if (!channelData) {
    return <FallbackMention type="channel">{children}</FallbackMention>;
  }

  return (
    <span className={cn(baseClassName, 'align-bottom')}>
      <span className="flex items-center space-x-0.5">
        <span className="inline-block">
          <ChannelIcon type={channelData.type} />
        </span>
        <span>{channelData.name ?? children}</span>
      </span>
    </span>
  );
}

function RoleMention({
  message,
  children,
}: {
  message: DBMessage;
  children: string;
}) {
  const roleData = message.metadata?.roles?.[children];

  if (!roleData) {
    return <FallbackMention type="role">{children}</FallbackMention>;
  }

  return <span className={baseClassName}>@{roleData.name ?? children}</span>;
}

function UserMention({
  message,
  children,
}: {
  message: DBMessage;
  children: string;
}) {
  const userData = message.metadata?.users?.[children];

  if (!userData) {
    return <FallbackMention type="user">{children}</FallbackMention>;
  }

  return (
    <span className={baseClassName}>@{userData.username ?? children}</span>
  );
}

function FallbackMention({
  type,
  children,
}: {
  type?: MentionType;
  children: string;
}) {
  const prefix = type === 'channel' ? '#' : '@';

  return (
    <span className={baseClassName}>
      {prefix}
      {children}
    </span>
  );
}

export function ChannelIcon({ type }: { type: number }) {
  switch (type) {
    case ChannelType.GuildForum:
      return <ChatsCircleIcon className="inline-block size-4" />;
    case ChannelType.PublicThread:
      return <ThreadIcon className="inline-block size-4" />;
    default:
      return <HashIcon className="inline-block size-4" weight="bold" />;
  }
}

export function ThreadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      height="24"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 2.81a1 1 0 0 1 0-1.41l.36-.36a1 1 0 0 1 1.41 0l9.2 9.2a1 1 0 0 1 0 1.4l-.7.7a1 1 0 0 1-1.3.13l-9.54-6.72a1 1 0 0 1-.08-1.58l1-1L12 2.8Zm0 18.39a1 1 0 0 1 0 1.41l-.35.35a1 1 0 0 1-1.41 0l-9.2-9.19a1 1 0 0 1 0-1.41l.7-.7a1 1 0 0 1 1.3-.12l9.54 6.72a1 1 0 0 1 .07 1.58l-1 1zm3.66-4.4a1 1 0 0 1-1.38.28l-8.49-5.66A1 1 0 1 1 6.9 9.76l8.49 5.65a1 1 0 0 1 .27 1.39m1.44-2.55a1 1 0 1 0 1.11-1.66L9.73 6.93a1 1 0 0 0-1.11 1.66l8.49 5.66Z"
        fill="currentColor"
      />
    </svg>
  );
}
