"use client";

import DashboardLayout from "@/components/dashboard/DashboardLayout";

/**
 * Admin pages live outside the /app route group, so they didn't inherit the
 * dashboard sidebar and rendered with no navigation at all. Wrapping them in
 * DashboardLayout restores the sidebar (which already includes the admin
 * section for admin users). Server-component admin pages are passed through as
 * `children` — a Client layout can render Server children.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
