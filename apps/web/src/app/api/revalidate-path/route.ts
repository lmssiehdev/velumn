import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { z } from "zod";

const schema = z.object({
	path: z.string(),
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

	const { path } = data;

	revalidatePath(path, "page");
	return Response.json({ revalidated: true });
}
