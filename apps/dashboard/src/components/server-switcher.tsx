"use client";

import { WarningIcon } from "@phosphor-icons/react/dist/ssr";
import type { DBServer } from "@repo/db/schema/discord";
import { getServerIcon } from "@repo/utils/helpers/discord";
import { ChevronsUpDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { useServer } from "@/providers/server";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

interface ServersSwitcherProps {
	servers: (DBServer & { finishedOnboarding?: boolean })[];
	activeServerId?: string;
	canAddMore?: boolean;
}

export function ServersSwitcher({
	servers,
	activeServerId,
	canAddMore = false,
}: ServersSwitcherProps) {
	const { server: activeServer } = useServer();
	const { isMobile } = useSidebar();
	const router = useRouter();

	if (!activeServer) {
		return null;
	}

	if (!servers.length) {
		return null;
	}

	function onAddServer() {
		router.push("/onboarding");
	}

	// Handle case with no servers
	if (servers.length === 0) {
		return (
			<SidebarMenu>
				<SidebarMenuItem>
					<SidebarMenuButton
						className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						size="lg"
						onClick={onAddServer}
					>
						<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
							<Plus className="size-4" />
						</div>
						<div className="grid flex-1 text-left text-sm leading-tight">
							<span className="truncate font-medium">Add Server</span>
							<span className="truncate text-xs">Get started</span>
						</div>
					</SidebarMenuButton>
				</SidebarMenuItem>
			</SidebarMenu>
		);
	}

	const icon = getServerIcon(activeServer);

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
							size="lg"
						>
							<Avatar className="h-8 w-8 rounded-lg">
								{activeServer.icon && (
									<AvatarImage alt={activeServer.name} src={icon!} />
								)}
								<AvatarFallback className="rounded-lg">
									{activeServer.name?.slice(0, 2).toUpperCase()}
								</AvatarFallback>
							</Avatar>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium">
									{activeServer.name}
								</span>
								<span className="truncate text-xs">{activeServer.plan}</span>
							</div>
							<ChevronsUpDown className="ml-auto" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="start"
						className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
						side={isMobile ? "bottom" : "right"}
						sideOffset={4}
					>
						<DropdownMenuLabel className="text-muted-foreground text-xs">
							Servers
						</DropdownMenuLabel>
						{servers.map((server) => (
							<DropdownMenuItem
								className="gap-2 p-2"
								key={server.id}
								onClick={() => {
									router.push(`/server/${server.id}`);
								}}
							>
								<Avatar className="h-6 w-6 rounded">
									{server.icon && (
										<AvatarImage
											alt={server.name}
											src={getServerIcon(server)!}
										/>
									)}
									<AvatarFallback className="rounded text-xs">
										{server.name?.slice(0, 2).toUpperCase()}
									</AvatarFallback>
								</Avatar>
								<span className="flex-1">{server.name}</span>
								<div className="flex items-center gap-1">
									{server.finishedOnboarding === false && (
										<div className="relative">
											<WarningIcon className="size-4 text-yellow-500" />
										</div>
									)}
									{server.id === activeServerId && (
										<DropdownMenuShortcut>✓</DropdownMenuShortcut>
									)}
								</div>
							</DropdownMenuItem>
						))}
						{canAddMore && (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem className="gap-2 p-2" onClick={onAddServer}>
									<div className="flex size-6 items-center justify-center rounded-md border">
										<Plus className="size-4" />
									</div>
									<div className="text-muted-foreground font-medium">
										Add Server
									</div>
								</DropdownMenuItem>
							</>
						)}
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={() => {
								router.push("/onboarding");
							}}
							className="gap-2 p-2"
						>
							<div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
								<Plus className="size-4" />
							</div>
							<div className="text-muted-foreground font-medium">
								Add Server
							</div>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
