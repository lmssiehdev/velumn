import { getAllThreads } from "@repo/db/helpers/servers";
import ServerPageClient from "@/components/server-page-client";
import { requireServerForPage } from "@/lib/authorization";
import { getCurrentUserOrRedirect } from "@/server/user";

interface ServerPageProps {
	params: Promise<{
		id: string;
	}>;
}

export default async function ServerPage({ params }: ServerPageProps) {
	const { id: serverId } = await params;
	const { user } = await getCurrentUserOrRedirect();
	const server = await requireServerForPage(user.id, serverId);

	const initialThreads = await getAllThreads("server", {
		id: server.id,
		pinFilter: "all",
		page: 1,
	});

	return (
		<ServerPageClient initialThreads={initialThreads} serverId={server.id} />
	);
}
