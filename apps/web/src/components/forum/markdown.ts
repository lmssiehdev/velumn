import type { DBMessageWithRelations } from "@repo/db/schema/discord";
import { getEmbedFileInfo } from "@repo/utils/helpers/misc";
import { snowflakeToDayjs } from "@repo/utils/helpers/time";
import { anonymizeName } from "./thread-message";
import type { ThreadWithMetadata } from "./thread-types";

export function formatThreadAsMarkdown(threadData: ThreadWithMetadata): string {
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

	const authorName = anonymizeName(starterMessage.user!, true);
	const replyDate = snowflakeToDayjs(starterMessage.id).format(dateFormat);

	sections.push(
		"## Original Post",
		"",
		`**@${authorName}** · ${replyDate}`,
		"",
		formatCommentContentAsMarkdown(starterMessage),
		"",
		"---",
		"",
	);

	const validReplies = replies.filter(
		(reply) =>
			(reply.cleanContent?.trim() || reply.attachments?.length) && reply.user,
	);

	if (validReplies.length > 0) {
		sections.push("## Replies", "");

		for (const [index, reply] of validReplies.entries()) {
			const replyAuthorName = anonymizeName(reply.user!, true);
			const formattedReplyDate = snowflakeToDayjs(reply.id).format(dateFormat);
			const isLastReply = index === validReplies.length - 1;

			sections.push(
				`**@${replyAuthorName}** · ${formattedReplyDate}`,
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

export function MarkdownResponse(content: string): Response {
	return new Response(content, {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			Vary: "Accept",
		},
	});
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
		const isImageAttachment = getEmbedFileInfo(attachment).type === "image";
		if (isImageAttachment) {
			sections.push(`![${attachment.name}](${attachment.proxyURL})`);
			continue;
		}

		sections.push(`[${attachment.name}](${attachment.proxyURL})`);
	}

	return sections.join("\n\n");
}
