import { Timestamp } from "firebase-admin/firestore";

/**
 * Programmatic API keys for partners. Format: `mspp_live_<random>` (or
 * `mspp_test_<random>` for the sandbox — no real scans, no billing).
 *
 * Only a SHA-256 hash + short prefix are persisted; the full secret is shown
 * once at mint time. A key is scoped to an org node and may act on that node
 * and its subtree only (authz = target org's `path` contains `orgId`).
 */

export type ApiKeyEnv = "live" | "test";

/** Coarse capability scopes; checked per-route. */
export type ApiScope =
  | "orgs:read"
  | "orgs:write"
  | "pentests:read"
  | "pentests:write"
  | "usage:read"
  | "keys:write"
  | "webhooks:write";

export interface ApiKeyDocument {
  id: string;
  /** e.g. "mspp_live_a1b2" — first bytes, safe to display/log. */
  prefix: string;
  /** SHA-256 hex of the full secret. The secret itself is never stored. */
  hash: string;
  env: ApiKeyEnv;
  /** Org node this key is bound to; grants access to this node + subtree. */
  orgId: string;
  name: string;
  scopes: ApiScope[];
  createdAt: Timestamp;
  createdBy?: string;
  lastUsedAt?: Timestamp;
  /** Set when revoked; a revoked key fails auth. */
  revokedAt?: Timestamp;
}

/** Resolved principal after a key (or Firebase token) authenticates. */
export interface ApiPrincipal {
  kind: "api_key" | "firebase";
  /** For api_key: the key's orgId. For firebase: the user's orgId. */
  orgId: string;
  /** Materialized path of the principal's org, for subtree authz. */
  path: string[];
  scopes: ApiScope[];
  env: ApiKeyEnv;
  /** Present for firebase principals. */
  uid?: string;
  /** Present for api_key principals. */
  keyId?: string;
}
