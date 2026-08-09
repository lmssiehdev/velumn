import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const outputRoot = path.join(appRoot, ".vercel/output")
const serverRoot = path.join(outputRoot, "functions/__server.func")
const clientAssets = path.join(outputRoot, "static/assets")
const serverEntry = path.join(serverRoot, "index.mjs")

const vercelConfig = JSON.parse(
  await readFile(path.join(outputRoot, "config.json"), "utf8")
)
const functionConfig = JSON.parse(
  await readFile(path.join(serverRoot, ".vc-config.json"), "utf8")
)
const nitroManifest = JSON.parse(
  await readFile(path.join(outputRoot, "nitro.json"), "utf8")
)

assert(vercelConfig.version === 3, "Expected Vercel Build Output API v3")
assert(nitroManifest.preset === "vercel", "Expected the Nitro Vercel preset")
assert(
  functionConfig.runtime === "nodejs22.x",
  `Expected nodejs22.x, received ${functionConfig.runtime}`
)
assert(
  functionConfig.supportsResponseStreaming === true,
  "Expected the Vercel function to support response streaming"
)
assert(
  functionConfig.handler === "index.mjs",
  `Expected index.mjs function handler, received ${functionConfig.handler}`
)
assert(
  vercelConfig.routes.some(
    (route) =>
      route.src === "/assets/(.*)" &&
      route.headers?.["cache-control"] === "public, max-age=31536000, immutable"
  ),
  "Expected immutable caching for built assets"
)
assert(
  vercelConfig.routes.some(
    (route) => route.src === "/(.*)" && route.dest === "/__server"
  ),
  "Expected Vercel to route dynamic requests to __server"
)

const manifestFiles = (await readdir(serverRoot)).filter((file) =>
  file.startsWith("_tanstack-start-manifest_")
)
assert(
  manifestFiles.length === 1,
  `Expected one production manifest, found ${manifestFiles.length}`
)

const manifestModule = await import(
  pathToFileURL(path.join(serverRoot, manifestFiles[0])).href
)
const routes = manifestModule.tsrStartManifest().routes
assert(routes.__root__, "Production manifest is missing __root__")
assert(routes["/"], "Production manifest is missing /")
assert(routes["/thread"], "Production manifest is missing /thread")
assert(
  routes["/thread/$threadId/$slug"],
  "Production manifest is missing the public thread page"
)
const publicAssets = new Set([
  ...collectRouteAssets(routes.__root__),
  ...collectRouteAssets(routes["/"]),
])
const publicThreadAssets = new Set([
  ...collectRouteAssets(routes["/thread"]),
  ...collectRouteAssets(routes["/thread/$threadId/$slug"]),
])
const privateAssets = new Set(
  Object.entries(routes)
    .filter(
      ([routeId]) =>
        routeId.startsWith("/dashboard") ||
        routeId.startsWith("/__tenant") ||
        routeId === "/api/auth/$"
    )
    .flatMap(([, route]) => collectRouteAssets(route))
)

for (const asset of publicAssets) {
  assert(
    !privateAssets.has(asset),
    `Public root shares a private route asset: ${asset}`
  )
}
for (const asset of publicThreadAssets) {
  assert(
    !/(?:^|[-_/])(dashboard|auth(?:-functions|-client)?|queries?|server-auth)(?:[-_./]|$)/i.test(
      asset
    ),
    `Public thread loads a dashboard or auth feature asset: ${asset}`
  )
}

const dashboardCss = new Set()
for (const file of await readdir(clientAssets)) {
  if (!file.endsWith(".css")) continue
  const content = await readFile(path.join(clientAssets, file), "utf8")
  if (content.includes(".dashboard-surface")) {
    dashboardCss.add(`/assets/${file}`)
  }
}
assert(dashboardCss.size > 0, "Could not identify the dashboard stylesheet")

const { default: server } = await import(pathToFileURL(serverEntry).href)
const response = await server.fetch(
  new Request("https://velumn.com/", {
    headers: { accept: "text/html" },
  })
)
const html = await response.text()

assert(
  response.status === 200,
  `Expected / to return 200, received ${response.status}`
)
assert(
  response.headers.get("content-type")?.includes("text/html"),
  "Expected / to return HTML"
)
assert(
  response.headers.has("x-request-id"),
  "Expected / to return x-request-id"
)
assert(
  html.includes("Help more people find"),
  "Public root rendered unexpected content"
)

const htmlAssets = new Set(
  [...html.matchAll(/(?:href|src)="(\/assets\/[^"?]+)(?:\?[^"}]*)?"/g)].map(
    (match) => match[1]
  )
)

for (const asset of htmlAssets) {
  assert(
    publicAssets.has(asset) || (asset.endsWith(".css") && !dashboardCss.has(asset)),
    `HTML loads an undeclared public asset: ${asset}`
  )
  assert(
    !privateAssets.has(asset),
    `HTML loads a private route asset: ${asset}`
  )
  assert(!dashboardCss.has(asset), `HTML loads dashboard CSS: ${asset}`)
  assert(
    !/(?:^|[-_/])(dashboard|auth(?:-functions|-client)?|queries?|createServerFn|server-auth)(?:[-_./]|$)/i.test(
      asset
    ),
    `HTML loads a dashboard or auth asset: ${asset}`
  )
}

const forbiddenBrowserSignatures = [
  "@repo/db",
  "@vercel/sdk",
  "better-auth",
  "DATABASE_URL",
  "DISCORD_CLIENT_SECRET",
  "VERCEL_BEARER_TOKEN",
]
for (const asset of new Set([...publicAssets, ...publicThreadAssets])) {
  if (!asset.endsWith(".js")) continue
  const content = await readFile(
    path.join(clientAssets, path.basename(asset)),
    "utf8"
  )
  for (const signature of forbiddenBrowserSignatures) {
    assert(
      !content.includes(signature),
      `Public browser asset ${asset} contains server-only signature ${signature}`
    )
  }
}

const authFunctionAsset = (await readdir(clientAssets)).find((file) =>
  file.startsWith("auth-functions-")
)
assert(authFunctionAsset, "Could not find a built server-function client stub")
const authFunctionSource = await readFile(
  path.join(clientAssets, authFunctionAsset),
  "utf8"
)
const serverFunctionId = authFunctionSource.match(/[a-f0-9]{64}/)?.[0]
assert(
  serverFunctionId,
  "Could not read a server-function ID from the built stub"
)

await assertStatus(
  server,
  new Request("https://velumn.com/thread/not-a-snowflake/example"),
  404,
  "malformed public thread"
)
const markdownNotFound = await server.fetch(
  new Request("https://velumn.com/thread/not-a-snowflake/example.md")
)
assert(
  markdownNotFound.status === 404,
  `Expected malformed Markdown thread to return 404, received ${markdownNotFound.status}`
)
assert(
  markdownNotFound.headers
    .get("content-type")
    ?.includes("text/markdown; charset=utf-8"),
  "Expected malformed Markdown thread to retain the Markdown content type"
)
const negotiatedMarkdown = await server.fetch(
  new Request("https://velumn.com/thread/not-a-snowflake/example", {
    headers: { accept: "text/markdown" },
  })
)
assert(
  negotiatedMarkdown.status === 404,
  `Expected malformed unsuffixed thread to return 404, received ${negotiatedMarkdown.status}`
)
assert(
  !negotiatedMarkdown.headers.get("content-type")?.includes("text/markdown"),
  "Unsuffixed thread URL unexpectedly negotiated Markdown"
)
await assertStatus(
  server,
  new Request("https://velumn.com/markdown/not-a-snowflake"),
  404,
  "legacy Markdown path"
)

const csrfResponse = await server.fetch(
  new Request(`https://velumn.com/_serverFn/${serverFunctionId}`, {
    method: "POST",
    headers: {
      origin: "https://attacker.example",
      "sec-fetch-site": "cross-site",
    },
  })
)
assert(
  csrfResponse.status === 403,
  `Expected cross-site server-function request to return 403, received ${csrfResponse.status}`
)
assert(
  csrfResponse.headers.has("x-request-id"),
  "Expected CSRF rejection to return x-request-id"
)

await assertStatus(
  server,
  new Request("https://velumn.com/__tenant/docs.example.com/"),
  404,
  "direct internal tenant path"
)
await assertStatus(
  server,
  new Request("https://docs.example.com/dashboard"),
  404,
  "tenant-host dashboard path"
)
await assertStatus(
  server,
  new Request(`https://docs.example.com/_serverFn/${serverFunctionId}`, {
    method: "POST",
  }),
  404,
  "tenant-host server function"
)
await assertStatus(
  server,
  new Request("https://unknown.example/pricing"),
  404,
  "unsupported unknown-host path"
)
await assertStatus(
  server,
  new Request("https://velumn.com/", {
    headers: { host: "attacker.example" },
  }),
  400,
  "disagreeing request authority"
)

console.info(
  `Production isolation passed: ${htmlAssets.size} public resources, ${privateAssets.size} private resources excluded, CSRF and custom-host isolation enforced.`
)
process.exit(0)

function collectRouteAssets(route) {
  return [
    ...(route.preloads ?? []),
    ...(route.scripts ?? []).map((script) => script.attrs?.src),
    ...(route.css ?? []).map((stylesheet) =>
      typeof stylesheet === "string" ? stylesheet : stylesheet.href
    ),
  ].filter(Boolean)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function assertStatus(server, request, expectedStatus, label) {
  const result = await server.fetch(request)
  assert(
    result.status === expectedStatus,
    `Expected ${label} to return ${expectedStatus}, received ${result.status}`
  )
}
