import type {
  CloudScenarioRecord,
  CloudScenarioSummary,
  SavedScenario,
  SyncOperation,
} from '../domain/types'
import { loadScenarios, migrateScenario, replaceScenarios } from './scenarioStorage'
import type { StorageScope } from './scenarioStorage'

export type OrganizationMember = {
  userId: string
  name: string
  role: 'admin' | 'member'
}

export class SyncConflictError extends Error {
  constructor(readonly scenarioId: string) {
    super('別の端末で見積が更新されています。')
    this.name = 'SyncConflictError'
  }
}

export const SYNC_QUEUE_KEY = 'nissan_purchase_comparison_sync_queue_v2'
export const CLOUD_MIGRATION_KEY = 'nissan_purchase_comparison_cloud_migrated_v2'

function syncQueueKey(scope?: StorageScope): string {
  if (!scope) return SYNC_QUEUE_KEY
  return `${SYNC_QUEUE_KEY}:${encodeURIComponent(scope.organizationId)}:${encodeURIComponent(scope.userId)}`
}

function readQueue(storage: Storage = localStorage, scope?: StorageScope): SyncOperation[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(syncQueueKey(scope)) || '[]')
    return Array.isArray(parsed) ? (parsed as SyncOperation[]) : []
  } catch {
    return []
  }
}

function writeQueue(
  queue: SyncOperation[],
  storage: Storage = localStorage,
  scope?: StorageScope,
): void {
  storage.setItem(syncQueueKey(scope), JSON.stringify(queue))
}

export function getPendingSyncCount(
  storage: Storage = localStorage,
  scope?: StorageScope,
): number {
  return readQueue(storage, scope).length
}

function enqueue(
  operation: SyncOperation,
  storage: Storage = localStorage,
  scope?: StorageScope,
): void {
  const queue = readQueue(storage, scope).filter(
    (item) => item.scenarioId !== operation.scenarioId,
  )
  writeQueue([...queue, operation], storage, scope)
}

export function enqueueScenarioUpsert(
  record: SavedScenario,
  storage: Storage = localStorage,
  scope?: StorageScope,
): void {
  enqueue(
    {
      id: crypto.randomUUID(),
      type: 'upsert',
      scenarioId: record.id,
      queuedAt: new Date().toISOString(),
      status: 'pending',
      record,
    },
    storage,
    scope,
  )
}

export function enqueueScenarioDelete(
  scenarioId: string,
  storage: Storage = localStorage,
  scope?: StorageScope,
): void {
  enqueue(
    {
      id: crypto.randomUUID(),
      type: 'delete',
      scenarioId,
      queuedAt: new Date().toISOString(),
      status: 'pending',
    },
    storage,
    scope,
  )
}

async function responseMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown }
    if (typeof body.message === 'string') return body.message
  } catch {
    // The caller receives a stable fallback for non-JSON failures.
  }
  return 'クラウド同期に失敗しました。'
}

export async function flushSyncQueue(
  storage: Storage = localStorage,
  scope?: StorageScope,
  forceScenarioId?: string,
): Promise<number> {
  let queue = readQueue(storage, scope)
  while (queue.length > 0) {
    const operation = queue[0]
    const upsertRecord = operation.type === 'upsert'
      ? {
          ...operation.record,
          scenario: migrateScenario(operation.record.scenario),
        }
      : null
    const response = await fetch(
      operation.type === 'delete'
        ? `/api/scenarios?id=${encodeURIComponent(operation.scenarioId)}${
            operation.scenarioId === forceScenarioId ? '&force=true' : ''
          }`
        : operation.scenarioId === forceScenarioId
          ? '/api/scenarios?force=true'
          : '/api/scenarios',
      {
        method: operation.type === 'delete' ? 'DELETE' : 'PUT',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-Sync-Queued-At': operation.queuedAt,
        },
        body: upsertRecord ? JSON.stringify(upsertRecord) : undefined,
      },
    )
    if (response.status === 409) throw new SyncConflictError(operation.scenarioId)
    if (!response.ok) throw new Error(await responseMessage(response))
    if (operation.type === 'upsert') {
      const body = (await response.json()) as { scenario?: CloudScenarioRecord }
      if (body.scenario) {
        replaceScenarios(
          [
            body.scenario,
            ...loadScenarios(storage, scope).filter((item) => item.id !== body.scenario?.id),
          ],
          storage,
          scope,
        )
      }
    }
    queue = queue.slice(1)
    writeQueue(queue, storage, scope)
  }
  return 0
}

export function discardScenarioSync(
  scenarioId: string,
  storage: Storage = localStorage,
  scope?: StorageScope,
): void {
  writeQueue(
    readQueue(storage, scope).filter((operation) => operation.scenarioId !== scenarioId),
    storage,
    scope,
  )
}

export async function fetchCloudScenarioSummaries(): Promise<CloudScenarioSummary[]> {
  const scenarios: CloudScenarioSummary[] = []
  let cursor: string | null = null
  do {
    const params = new URLSearchParams({ limit: '50' })
    if (cursor) params.set('cursor', cursor)
    const response = await fetch(`/api/scenarios?${params}`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(await responseMessage(response))
    const body = (await response.json()) as {
      scenarios?: CloudScenarioSummary[]
      nextCursor?: string | null
    }
    if (Array.isArray(body.scenarios)) scenarios.push(...body.scenarios)
    cursor = typeof body.nextCursor === 'string' ? body.nextCursor : null
  } while (cursor)
  return scenarios
}

export async function fetchCloudScenario(id: string): Promise<SavedScenario> {
  const response = await fetch(`/api/scenarios?id=${encodeURIComponent(id)}`, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(await responseMessage(response))
  const body = (await response.json()) as { scenario?: CloudScenarioRecord }
  if (!body.scenario) throw new Error('見積が見つかりません。')
  return {
    ...body.scenario,
    scenario: migrateScenario(body.scenario.scenario),
  }
}

export async function fetchOrganizationMembers(): Promise<OrganizationMember[]> {
  const response = await fetch('/api/members', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(await responseMessage(response))
  const body = (await response.json()) as { members?: OrganizationMember[] }
  return Array.isArray(body.members) ? body.members : []
}

export async function assignCloudScenarioOwner(
  id: string,
  member: OrganizationMember,
): Promise<CloudScenarioRecord> {
  const response = await fetch(`/api/scenarios?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownerUserId: member.userId, ownerName: member.name }),
  })
  if (!response.ok) throw new Error(await responseMessage(response))
  const body = (await response.json()) as { scenario?: CloudScenarioRecord }
  if (!body.scenario) throw new Error('担当者を割り当てられませんでした。')
  return body.scenario
}

export async function migrateLegacyCloudScenarios(): Promise<number> {
  const response = await fetch('/api/scenarios?action=migrate-legacy', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!response.ok) throw new Error(await responseMessage(response))
  const body = (await response.json()) as { migrated?: number }
  return typeof body.migrated === 'number' ? body.migrated : 0
}

function cloudMigrationKey(scope?: StorageScope): string {
  if (!scope) return CLOUD_MIGRATION_KEY
  return `${CLOUD_MIGRATION_KEY}:${encodeURIComponent(scope.organizationId)}:${encodeURIComponent(scope.userId)}`
}

export function hasCompletedCloudMigration(
  storage: Storage = localStorage,
  scope?: StorageScope,
): boolean {
  return storage.getItem(cloudMigrationKey(scope)) === 'complete'
}

export function markCloudMigrationComplete(
  storage: Storage = localStorage,
  scope?: StorageScope,
): void {
  storage.setItem(cloudMigrationKey(scope), 'complete')
}
