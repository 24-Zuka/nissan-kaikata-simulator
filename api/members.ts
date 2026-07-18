import type { ApiRequest, ApiResponse } from '../server/http.js'
import { authenticateActor, noStore } from '../server/auth.js'
import { listOrganizationMembers } from '../server/organizationMembers.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  noStore(response)
  const actor = await authenticateActor(request, response)
  if (!actor) return
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ message: '許可されていない操作です。' })
  }
  if (actor.role !== 'admin') {
    return response.status(403).json({ message: '管理者権限が必要です。' })
  }
  try {
    return response.status(200).json({ members: await listOrganizationMembers(actor) })
  } catch {
    return response.status(503).json({ message: '担当者一覧を取得できません。' })
  }
}
