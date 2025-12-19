import { getServerInfo } from "@repo/db/helpers/servers";
import { getCurrentUserOrRedirect } from "@/server/user";
import { CustomDomainInputGroup } from "./_components";

export default async function Page() {
	const { user } = await getCurrentUserOrRedirect();

	if (!user.serverId) {
		return <div>No server linked;</div>;
	}

	const server = await getServerInfo(user.serverId);

	return (
		<div>
			<div>
				<h1>Custom domain setup</h1>
			</div>
			<div className="max-w-[95%] w-full mx-auto">
				<div className="py-8 grid grid-cols-1 sm:grid-cols-8 gap-x-12 gap-y-4">
					<div className="col-span-3 flex flex-col gap-1">
						<div className="font-bold">Set up your domain </div>
						This domain will be assigned to your Production Deployment
					</div>
					<div className="col-span-5">
						<div className="text-sm">
							<div className="font-bold">Enter your domain URL</div>
							<p className="text-neutral-700">
								You can host your domain as a subdomain or a subpath
							</p>
						</div>
						<div className="w-full mt-2">
							<CustomDomainInputGroup
								initialDomain={server?.customDomain ?? ""}
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
