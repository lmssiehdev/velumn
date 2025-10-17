import { ChannelType } from "discord.js";
import { sapphireClient } from "../..";
import { TEST_GUILDS } from "../../constants";
import { indexThread } from "../channel";


sapphireClient?.addListener('clientReady', async () => {
    await indexSpecificThread();
});

async function indexSpecificThread() {
    const guild = await sapphireClient?.guilds.fetch(TEST_GUILDS.T);

    if (!guild) {
        return;
    }

    const channel = await guild.channels.fetch('1426766340273995950');
    if (channel?.type !== ChannelType.PublicThread) {
        return;
    }

    const r = await indexThread(channel);
    console.log(r, "Indexing thread complete");
}