import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { z } from "zod";

const MAX_TAG_LENGTH = 120;
const MAX_TAGS_PER_REQUEST = 30;

const tagSchema = z.string().trim().min(1).max(MAX_TAG_LENGTH);

const schema = z.object({
	tags: z
		.union([tagSchema, z.array(tagSchema).min(1).max(MAX_TAGS_PER_REQUEST)])
		.transform((x) => (Array.isArray(x) ? x : [x])),
	secret: z.string().min(1),
});

export async function POST(request: NextRequest) {
	const body = await request.json();
	const { data, success } = schema.safeParse(body);

	if (!success) {
		return Response.json({ error: "Invalid parameters" }, { status: 400 });
	}

	if (data.secret !== process.env.DISCORD_BOT_TOKEN) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const tags = [...new Set(data.tags)];

	for (const tag of tags) {
		revalidateTag(tag, "max");
	}
	return Response.json({ revalidated: true });
}
