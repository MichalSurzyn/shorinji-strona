"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase/server";
import { upsertArticleOverride } from "@/lib/articleContent";

export async function logoutAction() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function saveArticleAction(formData: FormData) {
  if (!(await getSessionUser())) {
    redirect("/admin/login");
  }

  const topic = String(formData.get("topic") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const title = String(formData.get("title") ?? "");
  const intro = String(formData.get("intro") ?? "");
  const body_md = String(formData.get("body_md") ?? "");

  const res = await upsertArticleOverride({ topic, slug, title, intro, body_md });

  if (!res.ok) {
    redirect(
      `/admin/edit/${topic}/${slug}?error=${encodeURIComponent(res.error ?? "Nie udało się zapisać.")}`,
    );
  }

  // Odśwież publiczną podstronę i listę tematu, żeby zmiana była widoczna od razu.
  revalidatePath(`/${topic}/${slug}`);
  revalidatePath(`/${topic}`);
  redirect(`/admin/edit/${topic}/${slug}?saved=1`);
}
