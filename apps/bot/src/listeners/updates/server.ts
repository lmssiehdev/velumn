import { upsertBulkChannels } from "@repo/db/helpers/channels";
import {
	getUserWhoInvited,
	linkServerToUser,
	upsertServer,
} from "@repo/db/helpers/servers";
import { resetUserServerIdLink } from "@repo/db/helpers/user";
import { ApplyOptions } from "@sapphire/decorators";
import { Listener } from "@sapphire/framework";
import { Events, type Guild } from "discord.js";
import { toDbChannel, toDbServer } from "../../helpers/convertion";
import { isChannelIndexable } from "../../indexing/server";

@ApplyOptions<Listener.Options>({
	event: Events.GuildCreate,
	name: "joined-guild",
})
export class JoinedGuild extends Listener {
	async run(guild: Guild) {
		try {
			let invitedBy = await getUserWhoInvited(guild.id);

			if (!invitedBy) {
				this.container.logger.error(
					"Only invites from the dashboard are allowed",
				);

				// TODO: leave if no valid invite, needs testing
				if (process.env.NODE_ENV === "production") {
					await guild.leave();
					return;
				}
				invitedBy = { userId: "1335068922067550229" };
			}
			// TODO: handle blacklisted servers and leave if necessary;
			// TODO: handle invite code;
			const converted = toDbServer(guild);
			await upsertServer({
				...converted,
				invitedBy: invitedBy?.userId,
			});

			// we save channels to display them in the onboarding flow
			const channels = await guild.channels.fetch();
			const channelsToIndex = channels
				.filter((c) => c != null && isChannelIndexable(c))
				.filter((c) => c?.viewable);

			// !! should probably be done in a transaction
			await linkServerToUser(guild.id, invitedBy.userId);
			const channelsToInsert = await Promise.all(
				channelsToIndex.map((x) => toDbChannel(x)),
			);
			await upsertBulkChannels(channelsToInsert);
		} catch (error) {
			this.container.logger.error("Error in JoinedGuild:", error);
		}
	}
}

// TODO: clean up message with a cron job
@ApplyOptions<Listener.Options>({
	event: Events.GuildDelete,
	name: "left-guild",
})
export class LeftGuild extends Listener {
	async run(guild: Guild) {
		try {
			const converted = toDbServer(guild);
			await upsertServer({ ...converted, kickedAt: new Date() });
			await resetUserServerIdLink(guild.id);
		} catch (error) {
			this.container.logger.error("Failed to leave guild", error);
		}
	}
}

@ApplyOptions<Listener.Options>({
	event: Events.GuildUpdate,
	name: "guild-update",
})
export class SyncOnUpdate extends Listener {
	async run(_: Guild, newGuild: Guild) {
		try {
			const converted = toDbServer(newGuild);
			await upsertServer(converted);
		} catch (error) {
			this.container.logger.error("Failed to update guild", error);
		}
	}
}
