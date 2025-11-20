"use client";
import useLocalStorage from "@/hooks/use-local-storage";
import { cn } from "@/lib/utils";
import { botClient } from "@/utils/trpc-client";
import { Twemoji } from "./markdown/emoji";
import { Button } from "./ui/button";

export default function ThreadFeedback({ threadId }: { threadId: string }) {
	const [votedThreads, setVotedThreads] = useLocalStorage<
		Record<string, "upvote" | "downvote" | undefined>
	>("votedThreads", {});

	const threadVote = votedThreads[threadId];

	// TODO: allow them to change vote
	async function handleVote(type: "upvote" | "downvote") {
		if (threadVote) {
			return;
		}
		try {
			const { success } = await botClient.updateVote.mutate({
				threadId,
				type,
			});
			if (success) {
				setVotedThreads((prev) => ({ ...prev, [threadId]: type }));
			}
		} catch (error) {
			console.error("Failed to vote on thread:", error);
		}
	}

	return (
		<div className="mb-20 flex w-full max-w-sm flex-col items-center rounded border border-neutral-300 p-4">
			<p className="p-2">Did this answer your question?</p>
			<div className="flex gap-5">
				<Button
					className={cn("flex gap-2 hover:scale-110", {
						"scale-110 bg-accent text-accent-foreground":
							threadVote === "upvote",
					})}
					disabled={threadVote === "upvote"}
					onClick={() => {
						handleVote("upvote");
					}}
					size={"sm"}
					variant={"ghost"}
				>
					<Twemoji className="size-5" name="👍" />
					Yes
				</Button>
				<Button
					className={cn("flex gap-2 hover:scale-110", {
						"scale-110 bg-accent text-accent-foreground":
							threadVote === "downvote",
					})}
					disabled={threadVote === "downvote"}
					onClick={() => {
						handleVote("upvote");
					}}
					size={"sm"}
					variant={"ghost"}
				>
					<Twemoji className="size-5" name="👍" />
					No
				</Button>
			</div>
		</div>
	);
}
