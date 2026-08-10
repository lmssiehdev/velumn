import type { ComponentType } from "react"

import { formatUtcDate } from "@/lib/date"

export interface PostMetadata {
  title: string
  description: string
  publishedAt: string
  updatedAt?: string
  thumbnail?: string
  thumbnailAlt?: string
}

interface PostModule {
  default: ComponentType
  metadata: unknown
}

export interface PostSummary {
  slug: string
  metadata: PostMetadata
}

const postModules = import.meta.glob<PostModule>(
  "/src/content/blog/published/*.mdx",
  { eager: true }
)
const postSources = import.meta.glob<string>(
  "/src/content/blog/published/*.mdx",
  {
    eager: true,
    import: "default",
    query: "?raw",
  }
)

export const posts = Object.entries(postModules)
  .flatMap(([path, postModule]) => {
    const slug = path.slice(path.lastIndexOf("/") + 1, -4)
    const source = postSources[path]

    if (!source) throw new Error(`Missing MDX source for blog post "${slug}"`)
    if (shouldExcludePost(slug, postModule.metadata)) return []

    const metadata = validateMetadata(slug, postModule.metadata)
    if (!hasContentBody(source)) {
      throw new Error(`Blog post "${slug}" must have a non-empty body`)
    }

    return [{ slug, metadata }]
  })
  .sort(
    (a, b) =>
      Date.parse(b.metadata.publishedAt) - Date.parse(a.metadata.publishedAt)
  )

const postsBySlug = new Map(posts.map((post) => [post.slug, post]))
const postComponents = new Map(
  Object.entries(postModules).map(([path, postModule]) => [
    path.slice(path.lastIndexOf("/") + 1, -4),
    postModule.default,
  ])
)

export function getPost(slug: string) {
  return postsBySlug.get(slug)
}

export function getPostComponent(slug: string) {
  if (!postsBySlug.has(slug)) return undefined
  return postComponents.get(slug)
}

export function formatPublishedAt(value: string) {
  return formatUtcDate(`${value}T00:00:00Z`, "long")
}

function shouldExcludePost(slug: string, value: unknown) {
  if (!isRecord(value)) return false
  if (value.draft === true || value.placeholder === true) return true

  const identifyingText = [slug, value.title, value.description]
    .filter((part): part is string => typeof part === "string")
    .join(" ")

  if (/\b(?:draft|placeholder|todo|coming soon)\b/i.test(identifyingText)) {
    return true
  }

  const publishedAt = value.publishedAt
  return (
    typeof publishedAt === "string" &&
    isIsoDate(publishedAt) &&
    Date.parse(`${publishedAt}T00:00:00Z`) > Date.now()
  )
}

function validateMetadata(slug: string, value: unknown): PostMetadata {
  if (!isRecord(value)) throw invalidMetadata(slug)

  const {
    description,
    publishedAt,
    thumbnail,
    thumbnailAlt,
    title,
    updatedAt,
  } = value
  if (
    !isNonEmptyString(title) ||
    !isNonEmptyString(description) ||
    !isIsoDate(publishedAt) ||
    (updatedAt !== undefined && !isIsoDate(updatedAt)) ||
    (thumbnail !== undefined && !isNonEmptyString(thumbnail)) ||
    (thumbnailAlt !== undefined && !isNonEmptyString(thumbnailAlt)) ||
    (thumbnail !== undefined && !isNonEmptyString(thumbnailAlt)) ||
    (typeof updatedAt === "string" && updatedAt < publishedAt)
  ) {
    throw invalidMetadata(slug)
  }

  return {
    title,
    description,
    publishedAt,
    ...(updatedAt === undefined ? {} : { updatedAt }),
    ...(thumbnail === undefined ? {} : { thumbnail }),
    ...(thumbnailAlt === undefined ? {} : { thumbnailAlt }),
  }
}

function hasContentBody(source: string) {
  const metadataStart = source.indexOf("export const metadata")
  if (metadataStart === -1) return source.trim().length > 0

  const openingBrace = source.indexOf("{", metadataStart)
  if (openingBrace === -1) return false

  let depth = 0
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1
    if (source[index] === "}") depth -= 1
    if (depth === 0) {
      return source.slice(index + 1).trim().length > 0
    }
  }

  return false
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

function invalidMetadata(slug: string) {
  return new Error(`Blog post "${slug}" has invalid metadata`)
}
