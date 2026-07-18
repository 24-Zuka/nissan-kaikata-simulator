import type { ApiRequest, ApiResponse } from '../../server/http.js'
import { noStore, requireAuthentication } from '../../server/auth.js'

export default function handler(
  request: ApiRequest,
  response: ApiResponse,
) {
  noStore(response)
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ message: '許可されていない操作です。' })
  }
  if (!requireAuthentication(request, response)) return
  return response.status(200).json({ authenticated: true })
}
