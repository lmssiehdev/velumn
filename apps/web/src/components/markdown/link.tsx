"use client";

import {
  CaretRightIcon,
  ChatTeardropIcon,
} from '@phosphor-icons/react/dist/ssr';
import type { DBMessage } from '@repo/db/schema/discord';
import { ChannelType } from 'discord-api-types/v10';
import { ChannelIcon } from './mention';

export function Link({
  target,
  content,
  message,
}: {
  target: string;
  content: string;
  message: DBMessage;
}) {
  const isInternalLink = message?.metadata?.internalLinks?.find(
    (x) => x.original === target
  );

  if (isInternalLink) {
    const { original, channel, message } = isInternalLink;
    const shortenedMessage =
      channel.name.length > 40
        ? `${channel.name?.slice(0, 40)}...`
        : channel.name;
    return (
      // @HACK work around nested a tags, refactor to an a tag in the future
      <span
        onClick={() => window.open(original, "_blank")}
        className="cursor-pointer not-prose space-x-0.5 rounded bg-purple-100 hover:bg-purple-200 p-0.5 text-purple-800"
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
      </span>
    );
  }

  return (
    <a href={target} rel="noreferrer" target="_blank">
      {content}
    </a>
  );
}
