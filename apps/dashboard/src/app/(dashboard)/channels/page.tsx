import { createServerApi } from "@/server/trpc/root";
import { getCurrentUserOrRedirect } from "@/server/user";
import Channels from "./_components";
export default async function Page() {
	const { user } = await getCurrentUserOrRedirect();

	if (!user.serverId) {
		return <div>No server linked;</div>;
	}

	const api = await createServerApi();
	const data = await api.server.getChannelsInServer({
		serverId: user.serverId,
	});

	return (
		<div className="">
			<Channels initialChannels={data.channels} />
		</div>
	);
}
