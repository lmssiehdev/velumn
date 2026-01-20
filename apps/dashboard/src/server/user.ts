import { getServerInfo } from "@repo/db/helpers/servers";
import { getUserServers } from "@repo/db/helpers/user";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";

export const getSession = cache(
	async () =>
		await auth.api.getSession({
			headers: await headers(),
		}),
);

export const getCurrentUserOrRedirect = cache(async () => {
	const session = await getSession();

	if (!session) {
		redirect("/auth/sign-in");
	}

	return {
		...session,
	};
});

export const getUserServer = cache(
	async (serverId: string) => await getServerInfo(serverId),
);

export const getUserServersData = cache(async (userId: string) => {
	const userServers = await getUserServers(userId);
	return userServers.map((us) => ({
		...us.server,
		finishedOnboarding: us.finishedOnboarding,
	}));
});
