import type { DBMessageWithRelations } from "@repo/db/schema/discord";
import { isEmbeddableAttachment } from "@repo/utils/helpers/misc";
import { snowflakeToDayjs } from "@repo/utils/helpers/time";
import { getAllMessagesInThreadsCache } from "@/utils/cache";
import { anonymizeName } from "../../thread/[...id]/_components/thread-message";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ threadId: string }> },
) {
	const { threadId } = await params;

	if (!threadId) {
		const content = `**Invalid Thread**`;
		return MarkdownResponse(content);
	}

	const thread = await getAllMessagesInThreadsCache(threadId);

	if (!thread?.server) {
		const content = `** Invalid Thread **`;
		return MarkdownResponse(content);
	}

	const [originalPost] = thread.messages;

	if (!originalPost) {
		return MarkdownResponse(`** Thread has no message **`);
	}

	return MarkdownResponse(formatThreadAsMarkdown(thread));
}

function formatThreadAsMarkdown(
	threadData: NonNullable<
		Awaited<ReturnType<typeof getAllMessagesInThreadsCache>>
	>,
): string {
	const [starterMessage, ...replies] = threadData.messages;

	if (!starterMessage) {
		return "# Empty Thread\n\nThis thread contains no messages.";
	}

	const sections: string[] = [];
	const dateFormat = "MMM DD, YYYY";

	const title =
		threadData.channelName ||
		starterMessage.content.slice(0, 100) ||
		"Untitled Thread";
	sections.push(`# ${title}`, "");

	const postedDate = snowflakeToDayjs(threadData.id).format(dateFormat);
	const metadata = [
		`**Server:** ${threadData.server?.name || "Unknown"}`,
		`**Channel:** #${threadData.parent?.channelName || "unknown"}`,
		`**Created At:** ${postedDate}`,
	];
	sections.push(metadata.join(" | "), "", "---", "");

	sections.push("## Original Post", "");
	const authorName = anonymizeName(starterMessage.user!, true);
	const replyDate = snowflakeToDayjs(starterMessage.id).format(dateFormat);

	sections.push(
		`**@${authorName}** · ${replyDate}`,
		"",
		formatCommentContentAsMarkdown(starterMessage),
		"",
		"---",
		"",
	);

	// Replies section
	const validReplies = replies.filter(
		(reply) =>
			(reply.cleanContent?.trim() || reply.attachments?.length) && reply.user,
	);

	if (validReplies.length > 0) {
		sections.push("## Replies", "");

		for (let i = 0; i < validReplies.length; i++) {
			const reply = validReplies[i];
			const authorName = anonymizeName(reply.user!, true);
			const replyDate = snowflakeToDayjs(reply.id).format(dateFormat);
			const isLastReply = i === validReplies.length - 1;

			sections.push(
				`**@${authorName}** · ${replyDate}`,
				"",
				formatCommentContentAsMarkdown(reply),
				"",
			);

			if (!isLastReply) {
				sections.push("---", "");
			}
		}
	}

	return sections.join("\n");
}

function formatCommentContentAsMarkdown(message: DBMessageWithRelations) {
	if (!message) {
		return "** Message not found **";
	}
	const sections: string[] = [];

	if (message.cleanContent) {
		sections.push(message.cleanContent);
	}

	for (const attachment of message.attachments ?? []) {
		const isImageAttachment = isEmbeddableAttachment(attachment);

		if (isImageAttachment) {
			sections.push(`![${attachment.name}](${attachment.proxyURL})`);
			continue;
		}

		sections.push(`[${attachment.name}](${attachment.proxyURL})`);
	}
	return sections.join("\n\n");
}

export function MarkdownResponse(content: string): Response {
	return new Response(content, {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
		},
	});
}
