import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import type { JWT } from 'next-auth/jwt';
import {
  ACCESS_TOKEN_TTL_MS,
  backendRefreshTokens,
  backendWebGoogle,
  backendWebLogin,
  type BackendAuthTokens,
} from '@/lib/backend-auth';
import { GoogleOAuthWithoutDiscovery } from '@/lib/google-oauth-provider';

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
          GoogleOAuthWithoutDiscovery({
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

      if (trigger === 'update' && session) {
        return {
          ...token,
          orgRoles:
            session.orgRoles !== undefined
              ? (session.orgRoles as string[])
              : token.orgRoles,
          roles:
            session.roles !== undefined
              ? (session.roles as string[])
              : token.roles,
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
          roles: Array.isArray(user.roles) ? user.roles : token.roles ?? [],
          orgRoles: Array.isArray(user.orgRoles)
            ? user.orgRoles
            : token.orgRoles ?? [],
          accessToken: user.accessToken,
          refreshToken: user.refreshToken,
          accessTokenExpires: Date.now() + ACCESS_TOKEN_TTL_MS,
        };
      }

      // Legacy cookies written before orgRoles existed: rehydrate from Nest.
      if (
        token.refreshToken &&
        token.orgRoles === undefined &&
        !(token.roles ?? []).includes('PLATFORM_ADMIN')
      ) {
        return refreshAccessToken(token);
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
      } as typeof session.user;
      session.accessToken = token.accessToken;
      if (token.error) {
        session.error = token.error;
      }
      return session;
    },
  },
  trustHost: true,
});
