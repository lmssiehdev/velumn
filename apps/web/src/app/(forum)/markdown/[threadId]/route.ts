import { getServerInfo } from "@repo/db/helpers/servers";
import {
	formatThreadAsMarkdown,
	MarkdownResponse,
} from "@/components/forum/markdown";
import { getCustomDomainUrl, hasVerifiedCustomDomain } from "@/lib/domains";
import { getAllMessagesInThreadsCache } from "@/utils/cache";

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

	const routingServer = await getServerInfo(thread.serverId);
	if (hasVerifiedCustomDomain(routingServer)) {
		return Response.redirect(
			getCustomDomainUrl(routingServer, `/markdown/${threadId}`),
			308,
		);
	}

	const [originalPost] = thread.messages;

	if (!originalPost) {
		return MarkdownResponse(`** Thread has no message **`);
	}

	return MarkdownResponse(formatThreadAsMarkdown(thread));
}
