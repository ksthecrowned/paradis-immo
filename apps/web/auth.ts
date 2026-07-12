import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import type { JWT } from 'next-auth/jwt';
import {
  ACCESS_TOKEN_TTL_MS,
  backendAdminGoogle,
  backendAdminLogin,
  backendRefreshTokens,
  backendVerifyOtp,
} from '@/lib/backend-auth';

function sessionFromBackendUser(
  tokens: Awaited<ReturnType<typeof backendAdminLogin>>,
): JWT {
  return {
    id: tokens.user.id,
    phone: tokens.user.phone,
    email: tokens.user.email ?? null,
    name: tokens.user.name ?? null,
    roles: tokens.user.roles,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpires: Date.now() + ACCESS_TOKEN_TTL_MS,
  };
}

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const refreshed = await backendRefreshTokens(token.refreshToken);
    return {
      ...token,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      accessTokenExpires: Date.now() + ACCESS_TOKEN_TTL_MS,
      id: refreshed.user.id,
      phone: refreshed.user.phone,
      email: refreshed.user.email ?? null,
      name: refreshed.user.name,
      roles: refreshed.user.roles,
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
      id: 'otp',
      name: 'OTP',
      credentials: {
        phone: { label: 'Phone', type: 'text' },
        code: { label: 'Code', type: 'text' },
      },
      async authorize(credentials) {
        const phone = credentials?.phone;
        const code = credentials?.code;
        if (typeof phone !== 'string' || typeof code !== 'string') {
          return null;
        }
        try {
          const tokens = await backendVerifyOtp(phone.trim(), code.trim());
          return {
            id: tokens.user.id,
            phone: tokens.user.phone,
            email: tokens.user.email ?? null,
            name: tokens.user.name ?? undefined,
            roles: tokens.user.roles,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
          };
        } catch {
          return null;
        }
      },
    }),
    Credentials({
      id: 'admin-password',
      name: 'Admin password',
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
          const tokens = await backendAdminLogin(email, password);
          return {
            id: tokens.user.id,
            phone: tokens.user.phone,
            email: tokens.user.email ?? email,
            name: tokens.user.name ?? undefined,
            roles: tokens.user.roles,
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
    error: '/admin/login',
  },
  callbacks: {
    async signIn({ account }) {
      if (account?.provider === 'google') {
        if (!account.id_token) return '/admin/login?error=AccessDenied';
        try {
          await backendAdminGoogle(account.id_token);
          return true;
        } catch {
          return '/admin/login?error=AccessDenied';
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (account?.provider === 'google' && account.id_token) {
        try {
          const tokens = await backendAdminGoogle(account.id_token);
          return sessionFromBackendUser(tokens);
        } catch {
          return { ...token, error: 'RefreshAccessTokenError' };
        }
      }

      if (user) {
        return {
          ...token,
          id: user.id,
          phone: user.phone,
          email: user.email ?? null,
          name: user.name,
          roles: user.roles,
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
        phone: token.phone,
        email: token.email ?? null,
        name: token.name ?? null,
        roles: token.roles ?? [],
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
