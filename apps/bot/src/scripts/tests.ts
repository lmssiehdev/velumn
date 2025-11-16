import { sapphireClient } from "..";

async function main() {
	return new Promise((resolve) => {
		setTimeout(() => {
			sapphireClient?.on("clientReady", async (client) => {
				try {
					const guild = client.guilds.cache.get("1028579842212106302");
					if (!guild) throw "not a guild";

					const channel = await guild.channels.fetch("1256869825624543282");
					if (!channel) throw "not a channel";

					const thread = await channel.threa;
				} catch (err) {
				} finally {
					resolve(true);
				}
			});
		}, 1000);
	});
}

await main();
