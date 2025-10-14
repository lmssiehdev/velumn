import { SingleASTNode } from '@khanacademy/simple-markdown';
import {
  CaretRightIcon,
  ChatsCircleIcon,
  ChatTeardropIcon,
} from '@phosphor-icons/react/dist/ssr';
import type { DBMessage } from '@repo/db/schema/discord';
import { ChannelType } from 'discord-api-types/v10';
import { ChannelIcon, ThreadIcon } from './mention';

export function Link({
  target,
  content,
  message,
}: {
  target: string;
  content: string;
  message: DBMessage;
}) {
  const isInternalLink = message?.metadata?.internalLinks.find(
    (x) => x.original === target
  );

  if (isInternalLink) {
    const { original, channel, message } = isInternalLink;
    const shortenedMessage =
      channel.name.length > 40
        ? channel.name!.slice(0, 40) + '...'
        : channel.name;
    return (
      <a
        className="not-prose space-x-0.5 rounded bg-purple-100 p-0.5 text-purple-800"
        href={original}
        rel="noreferrer"
        target="_blank"
      >
        {channel.parent?.type === ChannelType.GuildForum && message && (
          <span className="inline-block space-x-0.5">
            <span className="inline-block space-x-0.5">
              <ChannelIcon type={channel.parent?.type} />
              <span>{channel.parent?.name}</span>
            </span>
            <CaretRightIcon className="inline-block size-2.5 text-purple-800" />
          </span>
        )}
        <ChannelIcon type={channel.type} />
        <span>{shortenedMessage}</span>
        {message && (
          <span className="inline-block space-x-0.5 align-middle text-xs">
            <CaretRightIcon className="inline-block size-2.5 text-purple-800" />
            <ChatTeardropIcon
              className="inline-block size-4 text-purple-800"
              size={32}
              weight="fill"
            />
          </span>
        )}
      </a>
    );
  }

  return (
    <a href={target} rel="noreferrer" target="_blank">
      {content}
    </a>
  );
}
