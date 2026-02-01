import { getChannelsInServer } from "@repo/db/helpers/servers";
import { Settings } from "lucide-react";
import Link from "next/link";
import ChannelsTable from "@/components/channels-table";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { requireServerForPage } from "@/lib/authorization";
import { getCurrentUserOrRedirect } from "@/server/user";

interface ServerChannelsPageProps {
	params: Promise<{
		id: string;
	}>;
}

export default async function ServerChannelsPage({
	params,
}: ServerChannelsPageProps) {
	const { id: serverId } = await params;
	const { user } = await getCurrentUserOrRedirect();
	const server = await requireServerForPage(user.id, serverId);

	const channelsData = await getChannelsInServer(server.id);
	const channels = channelsData.map((c) => ({
		...c,
		channelName: c.channelName ?? "Unknown",
		enabled: c.indexingEnabled,
	}));

	if (channels.length === 0) {
		return (
			<div className="flex min-h-[400px] flex-col items-center justify-center space-y-6 p-8">
				<div className="max-w-lg space-y-3 text-center">
					<h2 className="font-semibold text-2xl">No Channels Found</h2>
					<p className="text-lg text-muted-foreground">
						This server doesn't have any text or forum channels that can be
						indexed.
					</p>
				</div>

				<div className="space-y-3 border-t pt-6 text-center">
					<Button asChild variant="outline">
						<Link href={`/server/${server.id}`}>
							<Settings className="mr-2 h-4 w-4" />
							Server Settings
						</Link>
					</Button>
				</div>
			</div>
		);
	}

	return (
		<>
			<ServerChannelsBreadcrumb />
			<div className="mx-auto w-full max-w-md mt-10">
				<ChannelsTable channels={channels} serverId={server.id} />
			</div>
		</>
	);
}

function ServerChannelsBreadcrumb() {
	return (
		<Breadcrumb className="p-2">
			<BreadcrumbList>
				<BreadcrumbItem>
					<BreadcrumbLink href="#" className="flex items-center gap-2">
						Home
					</BreadcrumbLink>
				</BreadcrumbItem>
				<BreadcrumbSeparator> / </BreadcrumbSeparator>
				<BreadcrumbItem>
					<BreadcrumbLink href="#">Documents</BreadcrumbLink>
				</BreadcrumbItem>
				<BreadcrumbSeparator> / </BreadcrumbSeparator>
				<BreadcrumbItem>
					<BreadcrumbPage>Channels</BreadcrumbPage>
				</BreadcrumbItem>
			</BreadcrumbList>
		</Breadcrumb>
	);
}
