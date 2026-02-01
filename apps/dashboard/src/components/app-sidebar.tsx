"use client";

import {
	ArrowUpRightIcon,
	DiscordLogoIcon,
	GlobeIcon,
	HashIcon,
	HouseIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { AuthUserInsert } from "@repo/db/schema/auth";
import type { DBServer } from "@repo/db/schema/discord";
import Link from "next/link";
import type * as React from "react";
import { NavUser } from "@/components/nav-user";
import { ServersSwitcher } from "@/components/server-switcher";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@/components/ui/sidebar";
import { useServer } from "@/providers/server";

const data = {
	projects: [
		{
			name: "Home",
			url: "/",
			icon: HomeIcon,
		},
		{
			name: "Channels",
			url: "/channels",
			icon: HashIcon,
		},
		{
			name: "Domain Setup",
			url: "/custom-domain",
			icon: GlobeIcon,
		},
	],
};

export function AppSidebar({
	user,
	servers,
	activeServerId,
	...props
}: React.ComponentProps<typeof Sidebar> & {
	user: AuthUserInsert;
	servers: DBServer[];
	activeServerId?: string;
}) {
	const { server } = useServer();
	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<ServersSwitcher servers={servers} activeServerId={activeServerId} />
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup className="group-data-[collapsible=icon]:hidden">
					<SidebarMenu>
						{server && (
							<>
								<SidebarMenuItem key={"Home"}>
									<SidebarMenuButton asChild>
										<Link href={`/server/${server.id}/`}>
											<HouseIcon />
											<span>Home</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
								<SidebarMenuItem key="Channels">
									<SidebarMenuButton asChild>
										<Link href={`/server/${server.id}/channels`}>
											<HashIcon />
											<span>Channels</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
								<SidebarMenuButton asChild>
									<a
										href={`https://velumn.com/server/${server.id}`}
										rel="noopener noreferrer"
										target="_blank"
									>
										<ArrowUpRightIcon /> View Forum
									</a>
								</SidebarMenuButton>
							</>
						)}
						<SidebarMenuButton asChild>
							<a
								href="https://velumn.com/discord"
								rel="noopener noreferrer"
								target="_blank"
							>
								<DiscordLogoIcon /> Get Help on Discord
							</a>
						</SidebarMenuButton>
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				<NavUser user={user} />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
