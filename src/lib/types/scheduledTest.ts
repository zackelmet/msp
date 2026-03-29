import { Timestamp } from "firebase-admin/firestore";

export type ScheduleFrequency = "once" | "weekly" | "monthly" | "quarterly";
export type ScheduledTestStatus = "pending" | "approved" | "running" | "completed" | "cancelled";
export type ScheduledTestType = "automated" | "manual";

export interface ScheduledTest {
  id: string;
  uid: string;
  targetGroupId: string;
  targetGroupName: string;
  clientName?: string;
  testType: ScheduledTestType;
  frequency: ScheduleFrequency;
  scheduledDate: Timestamp;
  notes?: string;
  status: ScheduledTestStatus;
  pentestId?: string;   // populated once the pentest is created
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
