import type { ApiRequest, ApiResponse } from '../../server/http.js'
import {
  clearSessionCookie,
  isSameOrigin,
  noStore,
} from '../../server/auth.js'

export default function handler(
  request: ApiRequest,
  response: ApiResponse,
) {
  noStore(response)
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ message: '許可されていない操作です。' })
  }
  if (!isSameOrigin(request)) {
    return response.status(403).json({ message: 'アクセス元を確認できません。' })
  }
  clearSessionCookie(response)
  return response.status(200).json({ authenticated: false })
}
