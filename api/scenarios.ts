import type { ApiRequest, ApiResponse } from '../server/http.js'
import {
  authenticateActor,
  isSameOrigin,
  noStore,
} from '../server/auth.js'
import {
  assignCloudScenario,
  deleteCloudScenario,
  getCloudScenario,
  listCloudScenarioSummaries,
  migrateLegacyScenarios,
  upsertCloudScenario,
} from '../server/cloudStore.js'
import type { SavedScenario } from '../src/domain/types.js'
import { isValidScenario } from '../server/scenarioSchema.js'
import { findOrganizationMember } from '../server/organizationMembers.js'

const MAX_BODY_BYTES = 100_000
const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/

function parseSavedScenario(value: unknown): SavedScenario | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const item = value as Record<string, unknown>
  if (typeof item.id !== 'string' || !ID_PATTERN.test(item.id)) return null
  if (typeof item.name !== 'string' || item.name.length > 120) return null
  if (!isValidScenario(item.scenario)) return null
  const scenario = item.scenario
  if (JSON.stringify(scenario).length > MAX_BODY_BYTES) return null
  return {
    id: item.id,
    name: item.name.trim() || '名称未設定',
    updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
    scenario,
    revision: typeof item.revision === 'number' ? item.revision : undefined,
  }
}

export default async function handler(
  request: ApiRequest,
  response: ApiResponse,
) {
  noStore(response)
  try {
    const actor = await authenticateActor(request, response)
    if (!actor) return

    if (request.method === 'GET') {
      const id = Array.isArray(request.query.id) ? request.query.id[0] : request.query.id
      if (id) {
        if (!ID_PATTERN.test(id)) {
          return response.status(400).json({ message: '見積IDを確認してください。' })
        }
        const scenario = await getCloudScenario(actor, id)
        return scenario
          ? response.status(200).json({ scenario })
          : response.status(404).json({ message: '見積が見つかりません。' })
      }
      const cursor = Array.isArray(request.query.cursor)
        ? request.query.cursor[0]
        : request.query.cursor
      const query = Array.isArray(request.query.q) ? request.query.q[0] : request.query.q
      const owner = Array.isArray(request.query.owner)
        ? request.query.owner[0]
        : request.query.owner
      const limitValue = Array.isArray(request.query.limit)
        ? request.query.limit[0]
        : request.query.limit
      return response.status(200).json(await listCloudScenarioSummaries(actor, {
        cursor,
        query,
        owner,
        limit: Number(limitValue) || 50,
      }))
    }
    if (!isSameOrigin(request)) {
      return response.status(403).json({ message: 'アクセス元を確認できません。' })
    }
    if (request.method === 'PUT') {
      const contentLength = Number(request.headers['content-length'] || 0)
      if (contentLength > MAX_BODY_BYTES) {
        return response.status(413).json({ message: '見積データが大きすぎます。' })
      }
      const saved = parseSavedScenario(request.body)
      if (!saved) {
        return response.status(400).json({ message: '見積データを確認してください。' })
      }
      const forceValue = Array.isArray(request.query.force)
        ? request.query.force[0]
        : request.query.force
      const queuedAtHeader = request.headers['x-sync-queued-at']
      const queuedAt = Array.isArray(queuedAtHeader) ? queuedAtHeader[0] : queuedAtHeader
      return response.status(200).json({
        scenario: await upsertCloudScenario(saved, actor, {
          force: forceValue === 'true',
          queuedAt: typeof queuedAt === 'string' && Number.isFinite(Date.parse(queuedAt))
            ? queuedAt
            : undefined,
        }),
      })
    }
    if (request.method === 'DELETE') {
      const id = Array.isArray(request.query.id) ? request.query.id[0] : request.query.id
      if (!id || !ID_PATTERN.test(id)) {
        return response.status(400).json({ message: '削除対象を確認してください。' })
      }
      const forceValue = Array.isArray(request.query.force)
        ? request.query.force[0]
        : request.query.force
      const queuedAtHeader = request.headers['x-sync-queued-at']
      const queuedAt = Array.isArray(queuedAtHeader) ? queuedAtHeader[0] : queuedAtHeader
      await deleteCloudScenario(actor, id, {
        force: forceValue === 'true',
        queuedAt: typeof queuedAt === 'string' && Number.isFinite(Date.parse(queuedAt))
          ? queuedAt
          : undefined,
      })
      return response.status(200).json({ deleted: true })
    }
    if (request.method === 'PATCH') {
      const id = Array.isArray(request.query.id) ? request.query.id[0] : request.query.id
      const ownerUserId = typeof request.body?.ownerUserId === 'string'
        ? request.body.ownerUserId
        : ''
      const ownerName = typeof request.body?.ownerName === 'string'
        ? request.body.ownerName
        : ''
      if (!id || !ID_PATTERN.test(id) || !ownerUserId) {
        return response.status(400).json({ message: '担当者の割当内容を確認してください。' })
      }
      const member = await findOrganizationMember(actor, ownerUserId)
      if (!member) {
        return response.status(400).json({ message: '店舗組織の担当者を選択してください。' })
      }
      return response.status(200).json({
        scenario: await assignCloudScenario(actor, id, member.userId, member.name || ownerName),
      })
    }
    const action = Array.isArray(request.query.action)
      ? request.query.action[0]
      : request.query.action
    if (request.method === 'POST' && action === 'migrate-legacy') {
      return response.status(200).json({ migrated: await migrateLegacyScenarios(actor) })
    }

    response.setHeader('Allow', 'GET, PUT, DELETE, PATCH, POST')
    return response.status(405).json({ message: '許可されていない操作です。' })
  } catch (error) {
    const reason = error instanceof Error ? error.message : ''
    if (reason === 'forbidden') {
      return response.status(403).json({ message: 'この見積を操作する権限がありません。' })
    }
    if (reason === 'revision-conflict') {
      return response.status(409).json({ message: '別の端末で見積が更新されています。' })
    }
    if (reason === 'stale-delete') {
      return response.status(409).json({ message: 'この見積は別の端末で削除されています。' })
    }
    if (reason === 'not-found') {
      return response.status(404).json({ message: '見積が見つかりません。' })
    }
    const message = reason === 'scenario-limit'
      ? '保存件数の上限に達しました。'
      : 'クラウド保存を利用できません。'
    return response.status(503).json({ message })
  }
}
