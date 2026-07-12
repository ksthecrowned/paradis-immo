import { customFetch } from '@auth/core';
import Google from 'next-auth/providers/google';
import type { OAuthUserConfig } from 'next-auth/providers';

/**
 * Static Google OIDC discovery document.
 * Auth.js normally fetches this at sign-in; that call fails on some Windows/DNS
 * setups (`fetch failed` → `/login?error=Configuration`).
 */
const GOOGLE_OPENID_CONFIG = JSON.stringify({
  issuer: 'https://accounts.google.com',
  authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  token_endpoint: 'https://oauth2.googleapis.com/token',
  userinfo_endpoint: 'https://openidconnect.googleapis.com/userinfo',
  revocation_endpoint: 'https://oauth2.googleapis.com/revoke',
  jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
  response_types_supported: ['code'],
  subject_types_supported: ['public'],
  id_token_signing_alg_values_supported: ['RS256'],
  scopes_supported: ['openid', 'email', 'profile'],
  token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
  claims_supported: ['aud', 'email', 'email_verified', 'exp', 'iat', 'iss', 'name', 'picture', 'sub'],
  code_challenge_methods_supported: ['plain', 'S256'],
});

function isGoogleDiscoveryUrl(url: string | URL): boolean {
  const href = String(url);
  return (
    href.includes('accounts.google.com') &&
    href.includes('.well-known/openid-configuration')
  );
}

async function googleFetch(
  ...args: Parameters<typeof fetch>
): Promise<Response> {
  const [input, init] = args;
  if (isGoogleDiscoveryUrl(input instanceof Request ? input.url : input)) {
    return new Response(GOOGLE_OPENID_CONFIG, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  return fetch(input, init);
}

export type GoogleProfile = {
  sub: string;
  name?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
};

/** Google provider that does not network-fetch OIDC discovery. */
export function GoogleOAuthWithoutDiscovery(
  options: OAuthUserConfig<GoogleProfile>,
) {
  return Google({
    ...options,
    [customFetch]: googleFetch,
  });
}
