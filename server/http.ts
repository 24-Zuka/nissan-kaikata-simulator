import type { IncomingMessage, ServerResponse } from 'node:http'

export type ApiRequest = IncomingMessage & {
  body?: Record<string, unknown>
  query: Record<string, string | string[] | undefined>
}

export type ApiResponse = ServerResponse & {
  status(code: number): ApiResponse
  json(body: unknown): void
}
