import { parseArgs } from "node:util";
import { ApplyOptions } from "@sapphire/decorators";
import { container, Events, Listener } from "@sapphire/framework";
import { ChannelType, type Client, Message, RESTJSONErrorCodes } from "discord.js";
import { indexServers } from "../core/indexing";
import { MessageLinkRegex } from "../helpers/regex";
import { safeParse, z } from "zod";
import { isChannelIndexable } from "../core/indexing/server";
import { toDbMetadata } from "../helpers/convertion";

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
      await testing(client);
      return;
    }

    // TODO: run this every day;
    await indexServers(client);
  }
}

const guilds = {
  namerio: "1228579842212106302",
  testserver: "1385955477912948806",
};

async function testing(client: Client) {
  container.logger.info("TESTING");
  const guild = client.guilds.cache.get(guilds.testserver);
  if (!guild) {
    return;
  }
  const channel = guild.channels.cache.get("1424556548524478555");
  if (channel?.type !== ChannelType.GuildText && channel?.type !== ChannelType.PublicThread) {
    return;
  }

  const message = await channel.messages.fetch("1424558925855985684");

  if (message.reference) {
    try {
      const repliedTo = await message.fetchReference();
      console.log(`Replying to: ${repliedTo.content}`);
    } catch (e) {
      if (e.code === RESTJSONErrorCodes.UnknownMessage) {
        console.log(`Message ${message.id} has been deleted`);
        return;
      }
      console.log("Couldn't fetch message", e);
    }
  }

  if (!message) {
    return;
  }

  console.log(await toDbMetadata(message));
}
