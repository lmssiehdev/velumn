"use client";
import { useEffect, useMemo, useState } from "react";
import useLocalStorage from "@/hooks/use-local-storage";
import { cn } from "@/lib/utils";
import { botClient } from "@/utils/trpc-client";
import { Twemoji } from "./markdown/emoji";
import { Button } from "./ui/button";

// @TODO: this is hacky, but it works for now
export default function ThreadFeedback({ threadId }: { threadId: string }) {
	const [mounted, setMounted] = useState(false);
	const [votedThreads, setVotedThreads] = useLocalStorage<
		Record<string, "upvote" | "downvote" | undefined>
	>("votedThreads", {});

	useEffect(() => {
		setMounted(true);
	}, []);

	const threadVote = mounted ? votedThreads[threadId] : undefined;

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

	const styles = useMemo(
		() =>
			({
				upvote:
					threadVote === "upvote"
						? "scale-110 bg-accent text-accent-foreground"
						: "",
				downvote:
					threadVote === "downvote"
						? "scale-110 bg-accent text-accent-foreground"
						: "",
			}) as const,
		[threadVote],
	);

	return (
		<div className="mb-20 flex w-full max-w-sm flex-col items-center rounded border border-neutral-300 p-4">
			<p className="p-2">Did this answer your question?</p>
			<div className="flex gap-5">
				<Button
					className={cn("flex gap-2 hover:scale-110", styles.upvote)}
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
					className={cn("flex gap-2 hover:scale-110", styles.downvote)}
					disabled={threadVote === "downvote"}
					onClick={() => {
						handleVote("downvote");
					}}
					size={"sm"}
					variant={"ghost"}
				>
					<Twemoji className="size-5" name="👎" />
					No
				</Button>
			</div>
		</div>
	);
}
