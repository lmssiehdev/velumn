import { parseArgs } from "node:util";
import { ApplyOptions } from "@sapphire/decorators";
import { Events, Listener } from "@sapphire/framework";
import { Cron } from "croner";
import type { Client } from "discord.js";
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
