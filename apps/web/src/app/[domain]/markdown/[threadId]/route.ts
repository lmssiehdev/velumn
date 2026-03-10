import { MarkdownResponse, formatThreadAsMarkdown } from "@/components/forum/markdown";
import { getTenantThreadOrNotFound } from "../../_lib/tenant";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ domain: string; threadId: string }> },
) {
	const { domain, threadId } = await params;

	if (!threadId) {
		return MarkdownResponse("**Invalid Thread**");
	}

	const { thread } = await getTenantThreadOrNotFound(domain, threadId);

	if (!thread.messages[0]) {
		return MarkdownResponse("** Thread has no message **");
	}

	return MarkdownResponse(formatThreadAsMarkdown(thread));
}
