import { Timestamp } from "firebase-admin/firestore";

export type EnvType = "web" | "network" | "cloud" | "mobile" | "api" | "mixed";

export interface Asset {
  id: string;
  label: string;   // e.g. "Production site"
  value: string;   // e.g. "https://app.client.com"
  type: "url" | "ip" | "cidr" | "domain" | "other";
}

export interface TargetGroup {
  id: string;
  uid: string;
  name: string;
  clientName?: string;
  envType: EnvType;
  assets: Asset[];
  assetCount: number;
  notes?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
