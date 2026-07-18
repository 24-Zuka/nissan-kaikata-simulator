import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialScenario } from '../domain/defaults'
import {
  enqueueScenarioDelete,
  enqueueScenarioUpsert,
  flushSyncQueue,
  getPendingSyncCount,
  SyncConflictError,
} from './cloudSync'

describe('cloud sync queue', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('keeps only the latest operation for each scenario', () => {
    const record = {
      id: 'scenario-1',
      name: '見積',
      updatedAt: new Date().toISOString(),
      scenario: createInitialScenario(),
    }
    enqueueScenarioUpsert(record)
    enqueueScenarioDelete(record.id)

    expect(getPendingSyncCount()).toBe(1)
  })

  it('flushes queued operations in order and clears the queue', async () => {
    const record = {
      id: 'scenario-1',
      name: '見積',
      updatedAt: new Date().toISOString(),
      scenario: createInitialScenario(),
    }
    enqueueScenarioUpsert(record)
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await flushSyncQueue()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/scenarios',
      expect.objectContaining({ method: 'PUT' }),
    )
    expect(getPendingSyncCount()).toBe(0)
  })

  it('leaves operations queued after a network failure', async () => {
    enqueueScenarioDelete('scenario-1')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))

    await expect(flushSyncQueue()).rejects.toThrow('offline')
    expect(getPendingSyncCount()).toBe(1)
  })

  it('keeps a conflicted operation queued and identifies its scenario', async () => {
    enqueueScenarioDelete('scenario-1')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ message: '別の端末で見積が更新されています。' }),
      { status: 409 },
    )))

    await expect(flushSyncQueue()).rejects.toEqual(
      expect.objectContaining<Partial<SyncConflictError>>({ scenarioId: 'scenario-1' }),
    )
    expect(getPendingSyncCount()).toBe(1)
  })

  it('migrates a queued v6 scenario before sending it as v11', async () => {
    const legacyScenario = createInitialScenario()
    legacyScenario.schemaVersion = 6
    const credit = legacyScenario.credit as unknown as Record<string, unknown>
    const bvc = legacyScenario.bvc as unknown as Record<string, unknown>
    delete credit.firstPayment
    delete credit.monthlyPayment
    delete bvc.firstPayment
    delete bvc.monthlyPayment
    enqueueScenarioUpsert({
      id: 'legacy-scenario',
      name: '旧見積',
      updatedAt: new Date().toISOString(),
      scenario: legacyScenario,
    })
    const fetchMock = vi.fn(async (...args: [RequestInfo | URL, RequestInit?]) => {
      void args
      return new Response('{}', { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    await flushSyncQueue()

    const request = fetchMock.mock.calls[0][1]!
    const sent = JSON.parse(String(request.body))
    expect(sent.scenario.schemaVersion).toBe(11)
    expect(sent.scenario.credit.firstPayment).toBe('')
    expect(sent.scenario.bvc.monthlyPayment).toBe('')
  })

  it('separates queues by organization and user', () => {
    const record = {
      id: 'scenario-1',
      name: '見積',
      updatedAt: new Date().toISOString(),
      scenario: createInitialScenario(),
    }
    const firstScope = { organizationId: 'org-1', userId: 'user-a' }
    const secondScope = { organizationId: 'org-1', userId: 'user-b' }

    enqueueScenarioUpsert(record, localStorage, firstScope)

    expect(getPendingSyncCount(localStorage, firstScope)).toBe(1)
    expect(getPendingSyncCount(localStorage, secondScope)).toBe(0)
  })
})
