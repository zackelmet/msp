import { getVerifiedUid } from "@/lib/firebase/adminSession";
import { redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase/firebaseAdmin";
import AdminConsole from "@/components/admin/AdminConsole";

export const dynamic = "force-dynamic";

async function isAdminUid(uid: string | undefined): Promise<boolean> {
  if (!uid) return false;
  const doc = await adminDb.collection("users").doc(uid).get();
  return doc.data()?.isAdmin === true;
}

export default async function AdminPage() {
  const uid = await getVerifiedUid();
  if (!(await isAdminUid(uid))) redirect("/app/dashboard");

  return (
    <div className="min-h-screen bg-[#0a141f]">
      <AdminConsole />
    </div>
  );
}
