import AdminsManager from "@/components/admin/AdminsManager";
import { listAdmins } from "@/actions/userActions";
import { getSessionUser } from "@/lib/supabase/server";

export default async function AdminUsersPage() {
  const user = await getSessionUser();
  const admins = await listAdmins();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Administratorzy</h1>
        <p className="text-slate-500 mt-1">
          Konta z dostępem do tego panelu. Każdy admin może edytować wszystkie
          treści.
        </p>
      </div>
      <AdminsManager initialAdmins={admins} currentUserId={user?.id ?? ""} />
    </div>
  );
}
