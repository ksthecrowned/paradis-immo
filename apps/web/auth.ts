import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import type { JWT } from 'next-auth/jwt';
import {
  ACCESS_TOKEN_TTL_MS,
  backendRefreshTokens,
  backendWebGoogle,
  backendWebLogin,
  type BackendAuthTokens,
} from '@/lib/backend-auth';

function sessionFromBackendUser(tokens: BackendAuthTokens): JWT {
  return {
    id: tokens.user.id,
    phone: tokens.user.phone,
    email: tokens.user.email ?? null,
    name: tokens.user.name ?? null,
    roles: tokens.user.roles,
    orgRoles: tokens.user.orgRoles,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpires: Date.now() + ACCESS_TOKEN_TTL_MS,
  };
}

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const refreshed = await backendRefreshTokens(token.refreshToken);
    return {
      ...sessionFromBackendUser(refreshed),
      error: undefined,
    };
  } catch {
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}

const googleConfigured =
  Boolean(process.env.AUTH_GOOGLE_ID) &&
  Boolean(process.env.AUTH_GOOGLE_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      id: 'web-password',
      name: 'Email password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== 'string' || typeof password !== 'string') {
          return null;
        }
        try {
          const tokens = await backendWebLogin(email, password);
          return {
            id: tokens.user.id,
            phone: tokens.user.phone,
            email: tokens.user.email ?? email,
            name: tokens.user.name ?? undefined,
            roles: tokens.user.roles,
            orgRoles: tokens.user.orgRoles,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
          };
        } catch {
          return null;
        }
      },
    }),
    ...(googleConfigured
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID!,
            clientSecret: process.env.AUTH_GOOGLE_SECRET!,
          }),
        ]
      : []),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async signIn({ account }) {
      if (account?.provider === 'google') {
        if (!account.id_token) return '/login?error=AccessDenied';
        try {
          await backendWebGoogle(account.id_token);
          return true;
        } catch {
          return '/login?error=AccessDenied';
        }
      }
      return true;
    },
    async jwt({ token, user, account, trigger, session }) {
      if (account?.provider === 'google' && account.id_token) {
        try {
          const tokens = await backendWebGoogle(account.id_token);
          return sessionFromBackendUser(tokens);
        } catch {
          return { ...token, error: 'RefreshAccessTokenError' };
        }
      }

      if (trigger === 'update' && session?.orgRoles) {
        return {
          ...token,
          orgRoles: session.orgRoles as string[],
          roles: (session.roles as string[]) ?? token.roles,
          accessToken: (session.accessToken as string) ?? token.accessToken,
          refreshToken: (session.refreshToken as string) ?? token.refreshToken,
        };
      }

      if (user) {
        return {
          ...token,
          id: user.id,
          phone: user.phone ?? null,
          email: user.email ?? null,
          name: user.name,
          roles: user.roles,
          orgRoles: user.orgRoles ?? [],
          accessToken: user.accessToken,
          refreshToken: user.refreshToken,
          accessTokenExpires: Date.now() + ACCESS_TOKEN_TTL_MS,
        };
      }

      if (Date.now() < token.accessTokenExpires) {
        return token;
      }

      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.user = {
        ...session.user,
        id: token.id,
        phone: token.phone ?? null,
        email: token.email ?? null,
        name: token.name ?? null,
        roles: token.roles ?? [],
        orgRoles: token.orgRoles ?? [],
      };
      session.accessToken = token.accessToken;
      if (token.error) {
        session.error = token.error;
      }
      return session;
    },
  },
  trustHost: true,
});
