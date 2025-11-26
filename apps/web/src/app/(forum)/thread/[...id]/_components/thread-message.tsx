import { DetectiveIcon, ImageIcon } from "@phosphor-icons/react/dist/ssr";
import type { DBUser } from "@repo/db/schema/discord";
import { snowflakeToReadableDate } from "@repo/utils/helpers/time";
import Link from "next/link";
import {
	adjectives,
	nouns,
	uniqueUsernameGenerator,
} from "unique-username-generator";
import {
	DiscordMarkdown,
	DiscordUIMessage,
} from "@/components/markdown/renderer";
import { DiscordIcon } from "@/components/misc";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { MessageWithMetadata } from "../page";
import { MessageHighlight } from "./message-highlight";

export function MessagePost({
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
		<MessageHighlight
			messageId={message.id}
			className={cn("p-3", { "border border-neutral-200": !isOriginalPost })}
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
							{false}
						</div>
					</div>
					<div>
						<DiscordUIMessage message={message} />
					</div>
				</div>
			</div>
		</MessageHighlight>
	);
}

function ReferenceMessage({ message }: { message: MessageWithMetadata }) {
	const user = message?.user!;

	if (!(message?.content || message?.attachments.length)) {
		return;
	}

	return (
		<div className="ml-2 flex items-center">
			<div className="flex w-[50px] flex-col items-end justify-end">
				<ReferenceLinkIcon className="size-8" />
			</div>
			{message ? (
				<a
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
								Click to see attachments <ImageIcon className="size-5" />{" "}
							</span>
						)}
					</span>
				</a>
			) : (
				<span className="text-sm italic">Original message was deleted</span>
			)}
		</div>
	);
}

export function anonymizeName(
	user: Pick<DBUser, "id" | "displayName" | "anonymizeName" | "isIgnored">,
) {
	if (!user) {
		return "Unknown";
	}

	if (!(user.anonymizeName || user.isIgnored)) {
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
			aria-label="Reply Spline"
			className={cn("inline-block shrink-0 text-current", className)}
			fill="none"
			height="4"
			viewBox="0 0 21 4"
			width="21"
		>
			<path d="M1 9V6a5 5 0 0 1 5-5h12" stroke="#72767D" />
		</svg>
	);
}
