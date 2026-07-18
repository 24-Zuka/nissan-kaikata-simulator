import { createClerkClient } from '@clerk/backend'
import type { AuthenticatedActor } from './auth.js'

export type OrganizationMember = {
  userId: string
  name: string
  role: 'admin' | 'member'
}

function configuredClient() {
  const secretKey = process.env.CLERK_SECRET_KEY
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY
  if (!secretKey || !publishableKey) return null
  return createClerkClient({ secretKey, publishableKey })
}

function memberName(data: {
  firstName: string | null
  lastName: string | null
  identifier: string
}): string {
  return [data.lastName, data.firstName].filter(Boolean).join(' ') || data.identifier
}

export async function listOrganizationMembers(
  actor: AuthenticatedActor,
): Promise<OrganizationMember[]> {
  if (actor.authMode === 'legacy') {
    return [{ userId: actor.userId, name: actor.displayName, role: actor.role }]
  }
  const client = configuredClient()
  if (!client) throw new Error('clerk-not-configured')
  const response = await client.organizations.getOrganizationMembershipList({
    organizationId: actor.organizationId,
    limit: 100,
  })
  return response.data.flatMap((membership) => {
    const user = membership.publicUserData
    if (!user) return []
    return [{
      userId: user.userId,
      name: memberName(user),
      role: membership.role === 'org:admin' ? 'admin' as const : 'member' as const,
    }]
  })
}

export async function findOrganizationMember(
  actor: AuthenticatedActor,
  userId: string,
): Promise<OrganizationMember | null> {
  return (await listOrganizationMembers(actor)).find((member) => member.userId === userId) ?? null
}
