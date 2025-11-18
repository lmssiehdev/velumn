import type { AuthUserInsert } from "@repo/db/schema/auth";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { getCurrentUserOrRedirect, getUserServer } from "@/server/user";
import { Providers } from "../providers";
import { ServerProvider } from "@/providers/server";
export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const { user } = await getCurrentUserOrRedirect();

	if (!user?.finishedOnboarding) {
		redirect("/onboarding");
	}

	if (!user?.serverId) {
		return <div>No server linked.</div>;
	}

	const server = await getUserServer(user.serverId);

	if ( !server ) {
  return <div>
    	Server Not Found
  	</div>
	}

	return (
		<Providers>
		<ServerProvider server={server}>
			<SidebarProvider>
				<AppSidebar servers={[server!]} user={user as AuthUserInsert} />
				<SidebarInset>
					<div className="w-full px-4">
						<header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
							<div className="flex items-center gap-2 px-4">
								<SidebarTrigger className="-ml-1" />
							</div>
						</header>
						{children}
					</div>
				</SidebarInset>
			</SidebarProvider>
		</ServerProvider>
		</Providers>
	);
}
