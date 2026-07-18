import { createHash } from 'node:crypto'
import { Redis } from '@upstash/redis'
import type {
  CloudScenarioRecord,
  CloudScenarioSummary,
  SavedScenario,
} from '../src/domain/types.js'
import type { AuthenticatedActor } from './auth.js'

const LEGACY_SCENARIOS_KEY = 'npc:scenarios:v1'
const MAX_SCENARIOS = 500

let redis: Redis | null = null

type Tombstone = {
  deletedAt: string
  deletedBy: string
}

function orgKeys(organizationId: string) {
  const prefix = `cpa:org:${organizationId}`
  return {
    scenarios: `${prefix}:scenarios:v2`,
    order: `${prefix}:scenario-order:v2`,
    tombstones: `${prefix}:scenario-tombstones:v2`,
  }
}

export function canAccessCloudScenario(
  actor: AuthenticatedActor,
  record: CloudScenarioRecord,
): boolean {
  if (record.organizationId !== actor.organizationId) return false
  return actor.role === 'admin' || record.ownerUserId === actor.userId
}

function summary(record: CloudScenarioRecord): CloudScenarioSummary {
  const { scenario: _scenario, ...result } = record
  void _scenario
  return result
}

export function getRedis(): Redis {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
    if (!url || !token) throw new Error('redis-not-configured')
    redis = new Redis({ url, token })
  }
  return redis
}

export async function listCloudScenarioSummaries(
  actor: AuthenticatedActor,
  options: { cursor?: string; limit?: number; query?: string; owner?: string } = {},
): Promise<{ scenarios: CloudScenarioSummary[]; nextCursor: string | null }> {
  const keys = orgKeys(actor.organizationId)
  const records = (await getRedis().hgetall<Record<string, CloudScenarioRecord>>(
    keys.scenarios,
  )) ?? {}
  const query = options.query?.trim().toLocaleLowerCase('ja-JP') || ''
  const requestedOwner = actor.role === 'admin' ? options.owner : actor.userId
  const filtered = Object.values(records)
    .filter((record) => canAccessCloudScenario(actor, record))
    .filter((record) => {
      if (!requestedOwner || requestedOwner === 'all') return true
      if (requestedOwner === 'unassigned') return record.ownerUserId === null
      if (requestedOwner === 'me') return record.ownerUserId === actor.userId
      return record.ownerUserId === requestedOwner
    })
    .filter((record) => !query || record.name.toLocaleLowerCase('ja-JP').includes(query))
    .sort((a, b) => b.serverUpdatedAt.localeCompare(a.serverUpdatedAt))
  const offset = Math.max(0, Number(options.cursor) || 0)
  const limit = Math.min(50, Math.max(1, options.limit || 50))
  const page = filtered.slice(offset, offset + limit).map(summary)
  const nextOffset = offset + page.length
  return {
    scenarios: page,
    nextCursor: nextOffset < filtered.length ? String(nextOffset) : null,
  }
}

export async function getCloudScenario(
  actor: AuthenticatedActor,
  id: string,
): Promise<CloudScenarioRecord | null> {
  const record = await getRedis().hget<CloudScenarioRecord>(orgKeys(actor.organizationId).scenarios, id)
  if (!record || !canAccessCloudScenario(actor, record)) return null
  return record
}

export async function upsertCloudScenario(
  saved: SavedScenario,
  actor: AuthenticatedActor,
  options: { force?: boolean; queuedAt?: string } = {},
): Promise<CloudScenarioRecord> {
  const store = getRedis()
  const keys = orgKeys(actor.organizationId)
  const existing = await store.hget<CloudScenarioRecord>(keys.scenarios, saved.id)
  if (existing && !canAccessCloudScenario(actor, existing)) throw new Error('forbidden')
  if (!existing && (await store.hlen(keys.scenarios)) >= MAX_SCENARIOS) {
    throw new Error('scenario-limit')
  }
  const tombstone = await store.hget<Tombstone>(keys.tombstones, saved.id)
  const clientOperationAt = options.queuedAt || saved.updatedAt
  if (tombstone && tombstone.deletedAt >= clientOperationAt && !options.force) {
    throw new Error('stale-delete')
  }
  if (
    existing
    && saved.revision !== undefined
    && saved.revision !== existing.revision
    && !options.force
  ) {
    throw new Error('revision-conflict')
  }

  const serverUpdatedAt = new Date().toISOString()
  const ownerUserId = existing ? existing.ownerUserId : actor.userId
  const record: CloudScenarioRecord = {
    ...saved,
    organizationId: actor.organizationId,
    ownerUserId,
    ownerName: existing ? existing.ownerName : actor.displayName,
    createdBy: existing?.createdBy || actor.userId,
    updatedBy: actor.userId,
    updatedAt: serverUpdatedAt,
    serverUpdatedAt,
    revision: (existing?.revision ?? 0) + 1,
  }
  const transaction = store.multi()
  transaction.hset(keys.scenarios, { [saved.id]: record })
  transaction.zadd(keys.order, { score: Date.parse(serverUpdatedAt), member: saved.id })
  transaction.hdel(keys.tombstones, saved.id)
  await transaction.exec()
  return record
}

export async function deleteCloudScenario(
  actor: AuthenticatedActor,
  id: string,
  options: { force?: boolean; queuedAt?: string } = {},
): Promise<void> {
  const store = getRedis()
  const keys = orgKeys(actor.organizationId)
  const existing = await store.hget<CloudScenarioRecord>(keys.scenarios, id)
  if (existing && !canAccessCloudScenario(actor, existing)) throw new Error('forbidden')
  if (
    existing
    && options.queuedAt
    && existing.serverUpdatedAt > options.queuedAt
    && !options.force
  ) {
    throw new Error('revision-conflict')
  }
  const tombstone: Tombstone = {
    deletedAt: new Date().toISOString(),
    deletedBy: actor.userId,
  }
  const transaction = store.multi()
  transaction.hdel(keys.scenarios, id)
  transaction.zrem(keys.order, id)
  transaction.hset(keys.tombstones, { [id]: tombstone })
  await transaction.exec()
}

export async function assignCloudScenario(
  actor: AuthenticatedActor,
  id: string,
  ownerUserId: string,
  ownerName: string,
): Promise<CloudScenarioRecord> {
  if (actor.role !== 'admin') throw new Error('forbidden')
  const keys = orgKeys(actor.organizationId)
  const record = await getRedis().hget<CloudScenarioRecord>(keys.scenarios, id)
  if (!record) throw new Error('not-found')
  const serverUpdatedAt = new Date().toISOString()
  const updated: CloudScenarioRecord = {
    ...record,
    ownerUserId,
    ownerName: ownerName.trim() || ownerUserId,
    updatedBy: actor.userId,
    serverUpdatedAt,
    updatedAt: serverUpdatedAt,
    revision: record.revision + 1,
  }
  await getRedis().hset(keys.scenarios, { [id]: updated })
  return updated
}

export async function migrateLegacyScenarios(
  actor: AuthenticatedActor,
): Promise<number> {
  if (actor.role !== 'admin') throw new Error('forbidden')
  const legacy = (await getRedis().hgetall<Record<string, SavedScenario>>(
    LEGACY_SCENARIOS_KEY,
  )) ?? {}
  let migrated = 0
  for (const saved of Object.values(legacy)) {
    const keys = orgKeys(actor.organizationId)
    if (await getRedis().hexists(keys.scenarios, saved.id)) continue
    const serverUpdatedAt = saved.updatedAt || new Date(0).toISOString()
    const record: CloudScenarioRecord = {
      ...saved,
      organizationId: actor.organizationId,
      ownerUserId: null,
      ownerName: '未割当',
      createdBy: 'legacy',
      updatedBy: 'legacy',
      serverUpdatedAt,
      revision: 1,
    }
    await getRedis().hset(keys.scenarios, { [saved.id]: record })
    await getRedis().zadd(keys.order, { score: Date.parse(serverUpdatedAt), member: saved.id })
    migrated += 1
  }
  return migrated
}

export async function consumeLoginAttempt(ip: string): Promise<boolean> {
  const key = `npc:login-attempt:${createHash('sha256').update(ip).digest('hex')}`
  const store = getRedis()
  const attempts = await store.incr(key)
  if (attempts === 1) await store.expire(key, 600)
  return attempts <= 5
}

export async function clearLoginAttempts(ip: string): Promise<void> {
  const key = `npc:login-attempt:${createHash('sha256').update(ip).digest('hex')}`
  await getRedis().del(key)
}
