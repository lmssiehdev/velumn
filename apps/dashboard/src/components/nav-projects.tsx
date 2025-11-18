"use client";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useServer } from "@/providers/server";
import { ArrowUpRightIcon, DiscordLogoIcon } from "@phosphor-icons/react/dist/ssr";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

export function NavProjects({
	projects,
}: {
	projects: {
		name: string;
		url: string;
		icon: LucideIcon;
	}[];
}) {
  const {server} = useServer();
  return (
		<SidebarGroup className="group-data-[collapsible=icon]:hidden">
			{/* <SidebarGroupLabel>Projects</SidebarGroupLabel> */}
			<SidebarMenu>
				{projects.map((item) => (
					<SidebarMenuItem key={item.name}>
						<SidebarMenuButton asChild>
							<Link href={item.url}>
								<item.icon />
								<span>{item.name}</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				))}
				<SidebarMenuButton asChild>
				<a
				  href={`https://velumn.com/server/${server.id}`}
					rel="noopener noreferrer"
					target="_blank"
				>
					<ArrowUpRightIcon /> View Forum
				</a>
				</SidebarMenuButton>
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
	);
}
