import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface User {
    id: string;
    phone: string;
    email?: string | null;
    name?: string | null;
    roles: string[];
    accessToken: string;
    refreshToken: string;
  }

  interface Session {
    accessToken: string;
    error?: 'RefreshAccessTokenError';
    user: {
      id: string;
      phone: string;
      email?: string | null;
      name?: string | null;
      roles: string[];
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    phone: string;
    email?: string | null;
    name?: string | null;
    roles: string[];
    accessToken: string;
    refreshToken: string;
    accessTokenExpires: number;
    error?: 'RefreshAccessTokenError';
  }
}
