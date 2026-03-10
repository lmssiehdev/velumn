import type { getAllMessagesInThreads } from "@repo/db/helpers/channels";
import type { getAllThreads } from "@repo/db/helpers/servers";

export type ThreadWithMetadata = NonNullable<
	Awaited<ReturnType<typeof getAllMessagesInThreads>>
>;

export type ThreadMessagesWithMetadata = ThreadWithMetadata["messages"][number];

export type ThreadListData = Awaited<ReturnType<typeof getAllThreads>>;
