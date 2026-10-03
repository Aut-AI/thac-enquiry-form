// Headers for server-side REST calls with the project's service key.
//
// During the move off Supabase's legacy keys (the old service_role JWT was
// leaked via a public commit, 2026-10-03), SB_THAC_SERVICE_ROLE_KEY holds
// either the legacy JWT or a new sb_secret_ key. Legacy JWTs go on both
// headers, as before; new keys must go on `apikey` only -- they aren't
// JWTs, so sending one as a Bearer token is rejected.
export function serviceKeyHeaders(key: string): Record<string, string> {
  return key.startsWith("eyJ")
    ? { apikey: key, Authorization: `Bearer ${key}` }
    : { apikey: key };
}
