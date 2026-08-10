import ChevronLeftIcon from "@hugeicons/core-free-icons/ChevronLeftIcon";
import ChevronRightIcon from "@hugeicons/core-free-icons/ChevronRightIcon";
import PinIcon from "@hugeicons/core-free-icons/PinIcon";
import { HugeiconsIcon } from "@hugeicons/react";
import { slugifyThreadUrl } from "@repo/utils/helpers/slugify";
import { snowflakeToReadableDate } from "@repo/utils/helpers/time";
import Link from "next/link";
import { ChatIcon } from "@/components/icons/phosphor-chat";
import { Button } from "@/components/ui/button";
import { anonymizeName } from "./thread-message";
import type { ThreadListData } from "./thread-types";

export function ThreadList({
	threads,
	page,
	hasMore,
	hrefBase,
}: {
	hrefBase: string;
} & ThreadListData) {
	if (threads.length === 0) {
		return (
			<div className="flex flex-1 flex-col items-center justify-center">
				<div className="flex flex-col gap-2 text-neutral-500">
					No threads found
					{page > 1 && (
						<Button asChild variant="secondary">
							<Link
								className="flex items-center gap-2 text-neutral-500 underline-offset-2 hover:underline"
								href={hrefBase}
							>
								Clear Filters
							</Link>
						</Button>
					)}
				</div>
			</div>
		);
	}

	const { pinnedThread, otherThreads } = threads.reduce(
		(acc, thread) => {
			if (thread.pinned) {
				acc.pinnedThread = thread;
				return acc;
			}
			acc.otherThreads.push(thread);
			return acc;
		},
		{
			pinnedThread: null as ThreadListData["threads"][number] | null,
			otherThreads: [] as ThreadListData["threads"],
		},
	);

	return (
		<div className="flex-1">
			<div>
				{pinnedThread && <ThreadItem data={pinnedThread} />}
				{otherThreads.map((thread) => (
					<ThreadItem data={thread} key={thread.id} />
				))}
			</div>
			<div className="mt-6 flex items-center justify-end gap-4">
				{page > 1 && (
					<Button asChild variant="ghost">
						<Link
							className="flex items-center gap-2 text-neutral-700 text-sm"
							href={`${hrefBase}?page=${page - 1}`}
						>
							<HugeiconsIcon icon={ChevronLeftIcon} />
							Prev
						</Link>
					</Button>
				)}
				{hasMore && (
					<Button asChild variant="ghost">
						<Link
							className="flex items-center gap-2 text-neutral-700 text-sm"
							href={`${hrefBase}?page=${page + 1}`}
						>
							Next
							<HugeiconsIcon icon={ChevronRightIcon} />
						</Link>
					</Button>
				)}
			</div>
		</div>
	);
}

function ThreadItem({ data }: { data: ThreadListData["threads"][number] }) {
	const { author, messages, messagesCount, parent } = data;
	const threadAuthor = author ?? messages[0]?.user;
	const authorName = anonymizeName(threadAuthor!);

	return (
		<div className="flex items-center justify-between gap-4 rounded border-neutral-300 border-b py-4">
			<div>
				<div>
					<Link
						prefetch={false}
						className="underline-offset-2 hover:underline"
						href={slugifyThreadUrl({
							id: data.id,
							name: data.channelName!,
						})}
					>
						{data.channelName}
					</Link>
					<div className="text-neutral-500 text-sm">
						by {authorName} • in{" "}
						<Link
							prefetch={false}
							className="underline-offset-2 hover:underline"
							href={`/channel/${parent?.id}`}
						>
							#{parent?.channelName}
						</Link>{" "}
						• {snowflakeToReadableDate(data.id)}
					</div>
				</div>
			</div>
			<div className="flex items-center gap-4">
				{data.pinned && <HugeiconsIcon className="size-5" icon={PinIcon} />}
				<div className="flex items-center gap-2">
					<ChatIcon className="size-5" />
					<span className="text-sm">{Math.max(0, messagesCount - 1)}</span>
				</div>
			</div>
		</div>
	);
}
