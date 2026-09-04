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

function sessionFromBackendUser(
  tokens: BackendAuthTokens,
  existing?: JWT,
): JWT {
  return {
    ...existing,
    sub: tokens.user.id,
    id: tokens.user.id,
    phone: tokens.user.phone,
    email: tokens.user.email ?? null,
    name: tokens.user.name ?? null,
    roles: tokens.user.roles,
    orgRoles: tokens.user.orgRoles ?? [],
    orgRolesHydrated: true,
    orgRolesCheckedAt: Date.now(),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpires: Date.now() + ACCESS_TOKEN_TTL_MS,
    error: undefined,
  };
}

function isPlatformAdmin(roles: string[] | undefined): boolean {
  return (roles ?? []).includes('PLATFORM_ADMIN');
}

function needsOrgRoleRehydrate(token: JWT): boolean {
  if (!token.refreshToken || token.error === 'RefreshAccessTokenError') {
    return false;
  }
  if (isPlatformAdmin(token.roles)) return false;
  const org = token.orgRoles;
  const empty = !Array.isArray(org) || org.length === 0;
  if (!empty) return false;
  // Empty orgRoles: re-check Nest periodically (seed restore / role granted
  // after login). Avoid hammering refresh on true first-login users.
  const last = token.orgRolesCheckedAt ?? 0;
  return Date.now() - last > 30_000;
}

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const refreshed = await backendRefreshTokens(token.refreshToken);
    return {
      ...sessionFromBackendUser(refreshed, token),
      orgRolesCheckedAt: Date.now(),
    };
  } catch {
    return {
      ...token,
      orgRolesCheckedAt: Date.now(),
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
          // Always re-read Nest user (incl. orgRoles) on every Google sign-in.
          return sessionFromBackendUser(tokens, token);
        } catch {
          return { ...token, error: 'RefreshAccessTokenError' };
        }
      }

      if (trigger === 'update') {
        // Explicit patch after setWebRole (client passes orgRoles / tokens).
        if (
          session &&
          (session.orgRoles !== undefined ||
            session.accessToken !== undefined ||
            session.roles !== undefined)
        ) {
          return {
            ...token,
            orgRoles:
              session.orgRoles !== undefined
                ? (session.orgRoles as string[])
                : token.orgRoles,
            orgRolesHydrated: true,
            orgRolesCheckedAt: Date.now(),
            roles:
              session.roles !== undefined
                ? (session.roles as string[])
                : token.roles,
            accessToken: (session.accessToken as string) ?? token.accessToken,
            refreshToken:
              (session.refreshToken as string) ?? token.refreshToken,
            accessTokenExpires:
              session.accessToken !== undefined
                ? Date.now() + ACCESS_TOKEN_TTL_MS
                : token.accessTokenExpires,
          };
        }
        // Bare update() → force Nest re-sync (stale empty orgRoles).
        if (token.refreshToken) {
          return refreshAccessToken(token);
        }
      }

      if (user) {
        const orgRoles = Array.isArray(user.orgRoles)
          ? user.orgRoles
          : token.orgRoles ?? [];
        return {
          ...token,
          sub: user.id,
          id: user.id,
          phone: user.phone ?? null,
          email: user.email ?? null,
          name: user.name,
          roles: Array.isArray(user.roles) ? user.roles : token.roles ?? [],
          orgRoles,
          orgRolesHydrated: true,
          orgRolesCheckedAt: Date.now(),
          accessToken: user.accessToken,
          refreshToken: user.refreshToken,
          accessTokenExpires: Date.now() + ACCESS_TOKEN_TTL_MS,
        };
      }

      // Stale cookie with missing/empty orgRoles while access token still valid:
      // rehydrate once from Nest so returning users are not sent to onboarding.
      if (needsOrgRoleRehydrate(token)) {
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
