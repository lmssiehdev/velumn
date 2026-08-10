import { loadTenantThread } from "./repository.server"
import { formatUtcDate } from "@/lib/date"

export async function getTenantThreadMarkdown(
  hostname: string,
  threadId: string
) {
  const thread = await loadTenantThread(hostname, threadId)
  if (!thread) return null

  const lines = [
    "---",
    `title: ${JSON.stringify(thread.title)}`,
    `summary: ${JSON.stringify(thread.description)}`,
    `canonical_url: ${JSON.stringify(thread.canonical.url)}`,
    `markdown_url: ${JSON.stringify(thread.canonical.markdownUrl)}`,
    `published_at: ${JSON.stringify(thread.createdAt)}`,
    `updated_at: ${JSON.stringify(thread.updatedAt)}`,
    "type: discussion",
    "---",
    "",
    `# ${escapeMarkdown(thread.title)}`,
    "",
    `**Community:** ${escapeMarkdown(thread.server.name)} | **Channel:** #${escapeMarkdown(thread.parent.name)} | **Created:** ${formatDate(thread.createdAt)}`,
    "",
    "## Original post",
    "",
    `**${escapeMarkdown(thread.starter.author.name)}** | ${formatDate(thread.starter.createdAt)}`,
    "",
    renderMessage(thread.starter),
  ]

  if (thread.replies.length > 0) {
    lines.push("", "## Replies", "")
    for (const [index, reply] of thread.replies.entries()) {
      lines.push(
        `**${escapeMarkdown(reply.author.name)}** | ${formatDate(reply.createdAt)}`,
        "",
        renderMessage(reply)
      )
      if (index < thread.replies.length - 1) lines.push("", "---", "")
    }
  }

  if (thread.truncated) {
    lines.push(
      "",
      "---",
      "",
      `[Continue this discussion on Discord](<${thread.discordUrl}>)`
    )
  }

  return { thread, content: `${lines.join("\n").trim()}\n` }
}

function renderMessage(message: {
  content: string
  attachments: Array<{
    name: string
    url: string
    contentType: string | null
  }>
}) {
  const sections = message.content ? [escapeMarkdown(message.content)] : []
  for (const attachment of message.attachments) {
    const label = escapeMarkdown(attachment.name)
    sections.push(
      attachment.contentType?.startsWith("image/")
        ? `![${label}](<${attachment.url}>)`
        : `[${label}](<${attachment.url}>)`
    )
  }
  return sections.join("\n\n")
}

function escapeMarkdown(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replace(/([`*_{}[\]()#+.!|>-])/g, "\\$1")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function formatDate(value: string) {
  return formatUtcDate(value, "long")
}
