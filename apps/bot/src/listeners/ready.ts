import { parseArgs } from "node:util";
import { ApplyOptions } from "@sapphire/decorators";
import { Events, Listener } from "@sapphire/framework";
import { Cron } from "croner";
import { type Client, MessageFlags } from "discord.js";
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
			// console.log("Skipping indexing");
			// try {
			// 	const guild = client.guilds.cache.get("1428114137191551119");
			// 	if (!guild) throw "not a guild";

			// 	const channel = await guild.channels.fetch("1436086670540800170");
			// 	if (!channel?.isThread()) throw "not a channel";

			// 	const message = await channel.messages.fetch("1436086670540800170");
			// 	if (!message) throw "not a message";
			// 	console.log({
			// 		message: await toDBMessage(message),
			// 	});
			// } catch (err) {
			// 	console.error("Failed to fetch message:", err);
			// }
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
