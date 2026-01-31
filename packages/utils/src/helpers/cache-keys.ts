export const CacheTags = {
	thread: (id: string) => `clear-thread-${id}`,
	server: (id: string) => `clear-server-${id}`,
	channelInfo: (id: string) => `clear-channel-info-${id}`,
	getAllThreads: (id: string) => `clear-get-all-threads-${id}`,
	topicsInServer: (id: string) => `clear-get-topics-in-server-${id}`,
} as const;
