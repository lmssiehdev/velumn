import { logger } from "@repo/logger";
import { botEnv } from "../config";

export async function invalidateTag(tag: string) {
	const url =
		process.env.NODE_ENV === "development"
			? "http://localhost:3000"
			: "https://velumn.com";
	try {
		await fetch(`https://velumn.com/api/revalidate-tag`, {
			method: "POST",
			body: JSON.stringify({ tag, secret: botEnv.DISCORD_BOT_TOKEN }),
		});
	} catch (error) {
		logger.error("failed_to_invalidate_cache", { error });
	}
}

export async function invalidatePath(path: string) {
	const url =
		process.env.NODE_ENV === "development"
			? "http://localhost:3000"
			: "https://velumn.com";
	try {
		await fetch(`https://velumn.com/api/revalidate-path`, {
			method: "POST",
			body: JSON.stringify({ path, secret: botEnv.DISCORD_BOT_TOKEN }),
		});
	} catch (error) {
		logger.error("failed_to_invalidate_cache", { error });
	}
}
