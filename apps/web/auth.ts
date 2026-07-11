import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import type { JWT } from 'next-auth/jwt';
import {
  ACCESS_TOKEN_TTL_MS,
  backendRefreshTokens,
  backendVerifyOtp,
} from '@/lib/backend-auth';

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
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        return {
          ...token,
          id: user.id,
          phone: user.phone,
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
