import type { AuthUserInsert } from "@repo/db/schema/auth";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ServerProvider } from "@/providers/server";
import { getCurrentUserOrRedirect, getUserServersData } from "@/server/user";
import { Providers } from "../providers";

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const { user } = await getCurrentUserOrRedirect();

	// Redirect to server selection page - we no longer check onboarding here
	// since users can have multiple servers with different onboarding statuses
	const servers = await getUserServersData(user.id);

	if (!servers.length) {
		redirect("/onboarding");
	}

	if (!user?.serverId) {
		return <div>Finished onboarding, but no server linked.</div>;
	}

	const server = await getUserServer(user.serverId);

	if (!server) {
		return <div>Server Not Found</div>;
	}

	return (
		<Providers>
			<ServerProvider servers={servers}>
				<SidebarProvider>
					<AppSidebar servers={servers} user={user as AuthUserInsert} />
					<SidebarInset>
						<div className="w-full px-4">{children}</div>
					</SidebarInset>
				</SidebarProvider>
			</ServerProvider>
		</Providers>
	);
}
