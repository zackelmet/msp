import { redirect } from "next/navigation";

// Consolidated into the single /admin console (Users tab).
export default function AdminUsersRedirect() {
  redirect("/admin?tab=users");
}
