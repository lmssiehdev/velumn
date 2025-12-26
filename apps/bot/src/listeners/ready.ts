import { parseArgs } from "node:util";
import { ApplyOptions } from "@sapphire/decorators";
import { Events, Listener } from "@sapphire/framework";
import { Cron } from "croner";
import { ChannelType, type Client } from "discord.js";
import { toDBMessage } from "../helpers/convertion";
import { indexServers } from "../indexing";

const { values } = parseArgs({
	args: process.argv.slice(2),
	options: {
		index: { type: "boolean" },
	},
});

@ApplyOptions<Listener.Options>({
	once: true,
	event: Events.ClientReady,
	name: "indexing-timer",
})
export class Indexing extends Listener {
	async run(client: Client) {
		if (!values.index) {
			const guild = await client.guilds.cache.get("1385955477912948806");
			if (!guild) {
				console.log("Guild not found");
				return;
			}
			const channel = await guild.channels.cache.get("1453840221673230388");
			if (!channel || channel.type !== ChannelType.PublicThread) {
				console.log("Channel not found");
				return;
			}
			const message = await channel.messages.fetch("1453841634554019890");
			if (!message) {
				console.log("Message not found");
				return;
			}
			const messagedb = await toDBMessage(message);
			console.log(messagedb);
			return;
		}
		await indexServers(client);
		new Cron(
			"0 0 * * *",
			{
				name: "server-indexing",
				protect: true,
				catch: (error) => {
					client.logger?.error("Cron indexing failed:", error);
				},
			},
			async () => {
				await indexServers(client);
			},
		);
	}
}
