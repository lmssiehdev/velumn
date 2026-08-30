import type {
  PublicThreadMessage,
  PublicThreadPage,
} from "@repo/db/helpers/public-content"

type StructuredDataThread = PublicThreadPage & {
  canonical: { origin: string; url: string }
}

type JsonLdValue =
  | boolean
  | number
  | string
  | null
  | undefined
  | readonly JsonLdValue[]
  | { readonly [key: string]: JsonLdValue }

export function buildDiscussionForumPostingJsonLd(
  thread: StructuredDataThread
) {
  const image = firstImage(thread.starter)
  if (!(thread.starter.content || image)) return null

  const comments = thread.replies.flatMap((reply) => {
    const replyImage = firstImage(reply)
    if (!(reply.content || replyImage)) return []

    return [
      {
        "@type": "Comment",
        identifier: reply.id,
        url: `${thread.canonical.url}#${reply.id}`,
        datePublished: reply.createdAt,
        author: {
          "@type": "Person",
          name: reply.author.name,
        },
        text: reply.content || undefined,
        image: replyImage,
      },
    ]
  })

  return {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    "@id": `${thread.canonical.url}#discussion`,
    url: thread.canonical.url,
    mainEntityOfPage: thread.canonical.url,
    identifier: thread.id,
    headline: thread.title,
    datePublished: thread.createdAt,
    dateModified: thread.updatedAt,
    author: {
      "@type": "Person",
      name: thread.starter.author.name,
    },
    publisher: {
      "@type": "Organization",
      name: thread.server.name,
      url: thread.server.canonicalDomain
        ? thread.canonical.origin
        : `${thread.canonical.origin}/server/${thread.server.id}`,
    },
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/CommentAction",
      userInteractionCount: thread.replyCount,
    },
    text: thread.starter.content || undefined,
    image,
    comment: comments.length > 0 ? comments : undefined,
  }
}

export function buildDiscussionForumPostingScripts(
  thread: StructuredDataThread
) {
  const data = buildDiscussionForumPostingJsonLd(thread)
  return data
    ? [
        {
          type: "application/ld+json",
          children: serializeJsonLd(data),
        },
      ]
    : []
}

export function serializeJsonLd(value: JsonLdValue) {
  return JSON.stringify(value).replaceAll("<", "\\u003c")
}

function firstImage(message: PublicThreadMessage) {
  return message.attachments.find((attachment) =>
    attachment.contentType?.startsWith("image/")
  )?.url
}
