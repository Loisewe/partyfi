import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@wishly/db'
import { generateNickname } from '@wishly/shared'
import jwt from 'jsonwebtoken'

// We use a custom JWT approach:
// NextAuth handles the OAuth dance, then we issue our own Wishly JWT
// that the Fastify API understands. This way the same JWT_SECRET works
// for both Next.js server calls and direct API calls from the client.

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!account) return false

      // Upsert user in our DB with isAnonymous=false
      const existingUser = await prisma.user.findFirst({
        where: {
          oauthProvider: account.provider,
          oauthId: account.providerAccountId,
        },
      })

      if (!existingUser) {
        // Check if user with same email exists (e.g., created via different provider)
        const byEmail = user.email
          ? await prisma.user.findUnique({ where: { email: user.email } })
          : null

        if (byEmail) {
          // Link the OAuth provider to the existing account
          await prisma.user.update({
            where: { id: byEmail.id },
            data: {
              oauthProvider: account.provider,
              oauthId: account.providerAccountId,
              avatarUrl: byEmail.avatarUrl ?? user.image ?? null,
              isAnonymous: false,
            },
          })
        } else {
          // Brand new user
          await prisma.user.create({
            data: {
              email: user.email ?? null,
              name: user.name ?? null,
              avatarUrl: user.image ?? null,
              oauthProvider: account.provider,
              oauthId: account.providerAccountId,
              isAnonymous: false,
              nickname: generateNickname(), // keep as fun display name even for authed users
            },
          })
        }
      }

      return true
    },

    async jwt({ token, account }) {
      // On initial sign-in, attach the DB user ID to the token
      if (account) {
        const dbUser = await prisma.user.findFirst({
          where: {
            oauthProvider: account.provider,
            oauthId: account.providerAccountId,
          },
        })
        if (dbUser) {
          token.sub = dbUser.id
          token.isAnonymous = false
        }
      }
      return token
    },

    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub

        // Issue a Wishly API access token (signed with JWT_SECRET)
        // This can be used directly against the Fastify API
        const wishlyToken = jwt.sign(
          { sub: token.sub, isAnonymous: false },
          process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
          { expiresIn: '15m' },
        )
        session.accessToken = wishlyToken
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
})

// Type augmentation for NextAuth session
declare module 'next-auth' {
  interface Session {
    accessToken?: string
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}
