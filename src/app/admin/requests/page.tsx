import { redirect } from "next/navigation";

// Consolidated into the single /admin console (Requests tab).
export default function AdminRequestsRedirect() {
  redirect("/admin?tab=requests");
}
