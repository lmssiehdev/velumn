import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { z } from "zod";

const schema = z.object({
	tags: z
		.union([z.string(), z.array(z.string())])
		.transform((x) => (Array.isArray(x) ? x : [x])),
	secret: z.string(),
});

export async function POST(request: NextRequest) {
	const { data, success } = schema.safeParse(await request.json());

	if (!success) {
		return Response.json({ error: "Invalid parameters" }, { status: 400 });
	}

	if (data.secret !== process.env.DISCORD_BOT_TOKEN) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { tags } = data;

	for (const tag of tags) {
		revalidateTag(tag, "max");
	}
	return Response.json({ revalidated: true });
}
