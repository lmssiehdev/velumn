import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { z } from "zod";

const schema = z.object({
	path: z.string().min(1),
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

	const { path } = data;

	revalidatePath(path, "page");
	return Response.json({ revalidated: true });
}
