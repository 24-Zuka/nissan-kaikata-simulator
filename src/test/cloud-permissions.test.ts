import { describe, expect, it } from 'vitest'
import { createInitialScenario } from '../domain/defaults'
import type { CloudScenarioRecord } from '../domain/types'
import type { AuthenticatedActor } from '../../server/auth'
import { canAccessCloudScenario } from '../../server/cloudStore'

function actor(
  userId: string,
  role: 'admin' | 'member',
  organizationId = 'org-a',
): AuthenticatedActor {
  return { userId, role, organizationId, displayName: userId, authMode: 'clerk' }
}

function record(ownerUserId: string | null, organizationId = 'org-a'): CloudScenarioRecord {
  return {
    id: 'scenario-1',
    name: '見積',
    updatedAt: '2026-07-10T00:00:00.000Z',
    scenario: createInitialScenario(),
    organizationId,
    ownerUserId,
    ownerName: ownerUserId || '未割当',
    createdBy: 'creator',
    updatedBy: 'updater',
    serverUpdatedAt: '2026-07-10T00:00:00.000Z',
    revision: 1,
  }
}

describe('cloud scenario permissions', () => {
  it('allows members to access only their own records', () => {
    expect(canAccessCloudScenario(actor('user-a', 'member'), record('user-a'))).toBe(true)
    expect(canAccessCloudScenario(actor('user-a', 'member'), record('user-b'))).toBe(false)
    expect(canAccessCloudScenario(actor('user-a', 'member'), record(null))).toBe(false)
  })

  it('allows admins within the organization, including unassigned records', () => {
    expect(canAccessCloudScenario(actor('admin', 'admin'), record('user-b'))).toBe(true)
    expect(canAccessCloudScenario(actor('admin', 'admin'), record(null))).toBe(true)
  })

  it('rejects records from another organization for every role', () => {
    expect(canAccessCloudScenario(actor('user-a', 'member'), record('user-a', 'org-b')))
      .toBe(false)
    expect(canAccessCloudScenario(actor('admin', 'admin'), record(null, 'org-b')))
      .toBe(false)
  })
})
