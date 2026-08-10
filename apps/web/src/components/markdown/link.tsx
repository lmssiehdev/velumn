"use client";

import ChevronRightIcon from "@hugeicons/core-free-icons/ChevronRightIcon";
import { HugeiconsIcon } from "@hugeicons/react";
import type { DBMessage } from "@repo/db/schema/discord";
import { ChannelType } from "discord-api-types/v10";
import { ChatTeardropIcon } from "@/components/icons/phosphor-chat";
import { ChannelIcon } from "./mention";

export function MarkdownLink({
	target,
	content,
	message,
}: {
	target: string;
	content: string;
	message: DBMessage;
}) {
	const isInternalLink = message?.metadata?.internalLinks?.find(
		(x) => x.original === target,
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
				className="not-prose cursor-pointer space-x-0.5 rounded bg-purple-100 p-0.5 text-purple-800 hover:bg-purple-200"
				onClick={() => window.open(original, "_blank")}
			>
				{channel.parent?.type === ChannelType.GuildForum && message && (
					<span className="inline-block space-x-0.5">
						<span className="inline-block space-x-0.5">
							<ChannelIcon type={channel.parent?.type} />
							<span>{channel.parent?.name}</span>
						</span>
						<HugeiconsIcon
							className="inline-block size-2.5 text-purple-800"
							icon={ChevronRightIcon}
						/>
					</span>
				)}
				<ChannelIcon type={channel.type} />
				<span>{shortenedMessage}</span>
				{message && (
					<span className="inline-block space-x-0.5 align-middle text-xs">
						<HugeiconsIcon
							className="inline-block size-2.5 text-purple-800"
							icon={ChevronRightIcon}
						/>
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
