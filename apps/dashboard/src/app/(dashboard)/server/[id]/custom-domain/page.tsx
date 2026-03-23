import { requireServerForPage } from "@/lib/authorization";
import { getCurrentUserOrRedirect } from "@/server/user";
import { CustomDomainSettings } from "./_components";

export default async function Page({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id: serverId } = await params;
	const { user } = await getCurrentUserOrRedirect();
	const server = await requireServerForPage(user.id, serverId);

	return (
		<div className="mx-auto max-w-4xl py-6">
			<div className="mb-6">
				<h1 className="font-semibold text-2xl">Custom domain</h1>
				<p className="text-muted-foreground text-sm">
					Configure the canonical public hostname for this server&apos;s forum.
				</p>
			</div>
			<CustomDomainSettings
				initialDomain={server.customDomain ?? null}
				serverId={server.id}
			/>
		</div>
	);
}
