"use client";

import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr";
import { TrackLink } from "@/components/analytics/track-link";
import { Twemoji } from "@/components/markdown/emoji";
import { rainbowButtonVariants } from "@/components/ui/rainbow-button";
import { useThread } from "@/providers/use-thread";

export function ContinueDiscussion({
	url,
	noReplies,
}: {
	url: string;
	noReplies: boolean;
}) {
	const { thread } = useThread();
	const icon = noReplies ? "👋" : "💬";
	return (
		<div className="mt-2 rounded-lg border border-neutral-200 p-5 shadow-sm transition-shadow">
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

				<TrackLink
					eventKey="openThreadOnDiscord"
					eventData={{
						threadId: thread.id,
						channelId: thread.parentId!,
						serverId: thread.serverId,
					}}
					className={rainbowButtonVariants({
						variant: "outline",
						class: "group",
					})}
					href={url}
					rel="noopener noreferrer"
					target="_blank"
				>
					Open in Discord{" "}
					<CaretRightIcon className="transition-transform duration-300 group-hover:translate-x-0.5" />
				</TrackLink>
			</div>
		</div>
	);
}
