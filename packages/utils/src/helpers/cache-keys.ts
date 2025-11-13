export const CacheTags = {
	thread: (id: string) => `clear-thread-${id}`,
	allThreads: () => "clear-all-threads",
	server: (id: string) => `clear-server-${id}`,
	allServers: () => "clear-all-servers",
	channelInfo: (id: string) => `clear-channel-info-${id}`,
	allChannelsInfo: () => "clear-all-channels-info",
	getAllThreads: (id: string) => `clear-get-all-threads-${id}`,
	clearAllGetThreads: () => "clear-get-all-threads",
	topicsInServer: (id: string) => `clear-get-topics-in-server-${id}`,
	allTopicsInServer: () => "clear-all-get-topics-in-server",
} as const;
