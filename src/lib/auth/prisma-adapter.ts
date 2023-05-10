import { NextApiRequest, NextApiResponse, NextPageContext } from 'next'
import { Adapter, AdapterUser, AdapterSession } from 'next-auth/adapters'
import { prisma } from '../prisma'
import { Session, User } from '@prisma/client'
import { parseCookies, destroyCookie } from 'nookies'

const mapUserToAdapterUser = (user: User): AdapterUser => ({
  id: user.id,
  name: user.name,
  username: user.username,
  email: user.email!,
  emailVerified: null,
  avatar_url: user.avatar_url!,
})

const mapSessionToAdapterSession = (session: Session): AdapterSession => ({
  sessionToken: session.session_token,
  expires: session.expires,
  userId: session.user_id,
})

export function PrismaAdapter(
  req: NextApiRequest | NextPageContext['req'],
  res: NextApiResponse | NextPageContext['res'],
): Adapter {
  return {
    async createUser(user) {
      const { '@ignitecall:userId': userIdOnCookies } = parseCookies({ req })

      if (!userIdOnCookies) {
        throw new Error('User ID not found on cookies')
      }

      const prismaUser = await prisma.user.update({
        where: {
          id: userIdOnCookies,
        },
        data: {
          name: user.name,
          email: user.email,
          avatar_url: user.avatar_url,
        },
      })

      destroyCookie({ res }, '@ignitecall:userId', {
        path: '/',
      })

      return mapUserToAdapterUser(prismaUser)
    },

    async getUser(id) {
      const user = await prisma.user.findUnique({
        where: {
          id,
        },
      })

      if (!user) return null

      return mapUserToAdapterUser(user)
    },

    async getUserByEmail(email) {
      const user = await prisma.user.findUnique({
        where: {
          email,
        },
      })

      if (!user) return null

      return mapUserToAdapterUser(user)
    },

    async getUserByAccount({ providerAccountId, provider }) {
      const account = await prisma.account.findUnique({
        where: {
          provider_provider_account_id: {
            provider,
            provider_account_id: providerAccountId,
          },
        },
        include: {
          user: true,
        },
      })

      if (!account) return null

      return mapUserToAdapterUser(account.user)
    },

    async updateUser(user) {
      const updatedUser = await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          name: user.name,
          email: user.email,
          avatar_url: user.avatar_url,
        },
      })

      return mapUserToAdapterUser(updatedUser)
    },

    async linkAccount(account) {
      await prisma.account.create({
        data: {
          user_id: account.userId,
          type: account.type,
          provider: account.provider,
          provider_account_id: account.providerAccountId,
          refresh_token: account.refresh_token,
          access_token: account.access_token,
          expires_at: account.expires_at,
          token_type: account.token_type,
          scope: account.scope,
          id_token: account.id_token,
          session_state: account.session_state,
        },
      })
    },

    async createSession({ sessionToken, userId, expires }) {
      const session = await prisma.session.create({
        data: {
          user_id: userId,
          expires,
          session_token: sessionToken,
        },
      })

      return mapSessionToAdapterSession(session)
    },

    async getSessionAndUser(sessionToken) {
      const session = await prisma.session.findUnique({
        where: {
          session_token: sessionToken,
        },
        include: {
          user: true,
        },
      })

      if (!session) return null

      return {
        user: mapUserToAdapterUser(session.user),
        session: mapSessionToAdapterSession(session),
      }
    },

    async updateSession({ sessionToken, userId, expires }) {
      const updatedSession = await prisma.session.update({
        where: {
          session_token: sessionToken,
        },
        data: {
          expires,
          user_id: userId,
        },
      })

      return mapSessionToAdapterSession(updatedSession)
    },

    async deleteSession(sessionToken) {
      await prisma.session.delete({
        where: {
          session_token: sessionToken,
        },
      })
    },
  }
}
