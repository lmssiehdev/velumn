type BaseClientPayload = {
	threadId: string;
	channelId: string;
	serverId: string;
};

export type ClientEvents = {
	openThreadOnDiscord: BaseClientPayload;
	joinServer: Pick<BaseClientPayload, "serverId"> & {
		serverInvite: string | null;
	};
	helpfulThreadVote: BaseClientPayload & {
		helpful: "yes" | "no";
	};
};
export type ClientEventKey = keyof ClientEvents;

export type EventPayload<K extends string> = K extends ClientEventKey
	? ClientEvents[K]
	: Record<string, unknown> | undefined;
