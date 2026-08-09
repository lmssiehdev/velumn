import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"

const requestLoggingMiddleware = createMiddleware({ type: "request" }).server(
  async ({ request, pathname, handlerType, serverFnMeta, next }) => {
    const startedAt = performance.now()
    const requestId = crypto.randomUUID()
    setResponseHeader("x-request-id", requestId)

    const fields = {
      requestId,
      method: request.method,
      pathname,
      handlerType,
      serverFnId: serverFnMeta?.id,
      serverFnName: serverFnMeta?.name,
    }

    try {
      const result = await next({ context: { requestId } })
      result.response.headers.set("x-request-id", requestId)
      writeLog("info", {
        event: "http.request.completed",
        ...fields,
        status: result.response.status,
        durationMs: elapsed(startedAt),
      })
      return result
    } catch (error) {
      writeLog("error", {
        event: "http.request.failed",
        ...fields,
        status: error instanceof Response ? error.status : 500,
        durationMs: elapsed(startedAt),
        ...toErrorFields(error),
      })
      throw error
    }
  }
)

const csrfMiddleware = createCsrfMiddleware({
  filter: ({ handlerType }) => handlerType === "serverFn",
})

const serverFunctionLoggingMiddleware = createMiddleware({
  type: "function",
}).server(async ({ context, method, serverFnMeta, next }) => {
  const startedAt = performance.now()
  const requestId = (context as unknown as { requestId?: string } | undefined)
    ?.requestId
  const fields = {
    requestId,
    method,
    serverFnId: serverFnMeta.id,
    serverFnName: serverFnMeta.name,
  }

  try {
    const result = await next()
    writeLog("info", {
      event: "server_function.completed",
      ...fields,
      durationMs: elapsed(startedAt),
    })
    return result
  } catch (error) {
    writeLog("error", {
      event: "server_function.failed",
      ...fields,
      durationMs: elapsed(startedAt),
      ...toErrorFields(error),
    })
    throw error
  }
})

export const startInstance = createStart(() => ({
  requestMiddleware: [requestLoggingMiddleware, csrfMiddleware],
  functionMiddleware: [serverFunctionLoggingMiddleware],
}))

function elapsed(startedAt: number) {
  return Math.round(performance.now() - startedAt)
}

function toErrorFields(error: unknown) {
  if (error instanceof Response) {
    return {
      errorType: "Response",
      errorStatus: error.status,
      errorStatusText: error.statusText,
    }
  }
  if (error instanceof Error) {
    return {
      errorType: error.name,
      errorMessage: error.message.slice(0, 500),
    }
  }
  return { errorType: "UnknownError" }
}

function writeLog(level: "info" | "error", fields: Record<string, unknown>) {
  const record = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    ...fields,
  })
  if (level === "error") console.error(record)
  else console.info(record)
}
