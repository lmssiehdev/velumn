export type ServerLifecycle = "setup_required" | "ready" | "bot_disconnected"

export const serverLifecycleLabels = {
  ready: "Live",
  setup_required: "Setup required",
  bot_disconnected: "Bot disconnected",
} satisfies Record<ServerLifecycle, string>

export type ServerIdentity = {
  id: string
  name: string
  icon: string | null
}

export type DashboardShell = {
  user: {
    id: string
    name: string
    email: string
    image: string | null
  }
  servers: Array<
    ServerIdentity & {
      role: "owner" | "admin" | "manager"
      capabilities: Array<string>
      lifecycle: ServerLifecycle
    }
  >
  lastUsedServerId: string | null
}

export type ServerListItem = ServerIdentity & {
  role: "owner" | "admin" | "manager"
  lifecycle: ServerLifecycle
  enabledChannelCount: number
  indexedThreadCount: number
  lastIndexedAt: string | null
  forumUrl: string | null
}

export type EligibleDiscordServer = ServerIdentity & {
  owner: boolean
  canManage: boolean
  installation:
    | "not_added"
    | "awaiting_bot"
    | "selecting_channels"
    | "bot_disconnected"
    | "ready"
}

export type SetupChannel = {
  id: string
  name: string
  type: "forum" | "text"
  selected: boolean
  existingThreadCount: number
}

export type ServerSetup =
  | {
      state: "invite_required"
      server: ServerIdentity
      requiredPermissions: Array<string>
    }
  | {
      state: "reconnect_required"
      server: ServerIdentity
      requiredPermissions: Array<string>
    }
  | {
      state: "waiting_for_bot"
      server: ServerIdentity
      lastCheckedAt: string
      inviteUrl: string
    }
  | {
      state: "select_channels"
      server: ServerIdentity
      channels: Array<SetupChannel>
    }
  | {
      state: "starting_index"
      server: ServerIdentity
      job: {
        id: string
        status: "queued" | "running" | "failed" | "succeeded"
        progress: null | { completed: number; total: number }
        startedAt: string | null
        error: string | null
      }
    }
  | {
      state: "failed"
      server: ServerIdentity
      message: string
      retryable: boolean
    }
  | { state: "ready"; serverId: string }

export type ThreadListItem = {
  id: string
  title: string
  parentChannel: { id: string; name: string }
  messageCount: number
  pinned: boolean
  lastIndexedAt: string | null
  discordUrl: string
  publicUrl: string
}

export type ServerOverview = {
  server: ServerIdentity
  forumUrl: string
  bot: {
    status: "connected" | "disconnected" | "unknown"
    lastSeenAt: string | null
  }
  indexing: {
    /** `unknown` until durable indexing job state is persisted. */
    status: "idle" | "queued" | "running" | "failed" | "unknown"
    lastSucceededAt: string | null
    error: string | null
  }
  channels: { eligible: number; enabled: number }
  threads: { total: number; recent: Array<ThreadListItem> }
  publishing: {
    domain: string | null
    status: "default" | "pending" | "verified" | "failed"
  }
}
