/**
 * Canonical Firestore collection names for the multi-tenant platform.
 * Flat top-level collections with a denormalized `path[]` on each doc — avoids
 * deep subcollections so collection-group queries and security rules stay simple.
 */
export const COLLECTIONS = {
  orgs: "orgs",
  tiers: "tiers",
  quotaPools: "quotaPools",
  orgCaps: "orgCaps",
  apiKeys: "apiKeys",
  usageLedger: "usageLedger",
  provisioningJobs: "provisioningJobs",
  users: "users",
  pentests: "pentests",
} as const;
