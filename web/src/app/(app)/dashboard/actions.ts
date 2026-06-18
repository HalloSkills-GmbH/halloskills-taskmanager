"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markNotificationRead(
  notificationId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { ok: false, message: "Nicht eingeloggt" };
  const { error } = await supabase
    .from("task_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.user.id)
    .is("read_at", null);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}
