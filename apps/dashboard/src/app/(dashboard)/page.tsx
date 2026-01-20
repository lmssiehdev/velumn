import { redirect } from "next/navigation";
import { getCurrentUserOrRedirect, getUserServersData } from "@/server/user";

export default async function DashboardPage() {
	const { user: currentUser } = await getCurrentUserOrRedirect();
	const servers = await getUserServersData(currentUser.id);

	redirect(`/server/${servers[0].id}`);
}
