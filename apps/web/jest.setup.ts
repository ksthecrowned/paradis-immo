// Set NEXT_PUBLIC_API_URL to a stable test value so lib/api.ts
// picks a deterministic base URL regardless of the dev environment.
process.env.NEXT_PUBLIC_API_URL = 'http://test.local/api/v1';
