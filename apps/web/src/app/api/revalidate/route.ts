import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { z } from "zod";

const schema = z.object({
	tag: z.enum(["clear-all-threads"]),
});

export async function POST(request: NextRequest) {
	const { data, success } = schema.safeParse(await request.json());

	if (!success) {
		return Response.json({ error: "Invalid parameters" }, { status: 400 });
	}

	const { tag } = data;

	revalidateTag(tag, "max");
	return Response.json({ revalidated: true });
}
