"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addTodo(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("personal_todos").insert({ user_id: user.id, text: trimmed });
  revalidatePath("/dashboard");
}

export async function toggleTodo(id: string, done: boolean) {
  const supabase = await createClient();
  await supabase.from("personal_todos").update({ done }).eq("id", id);
  revalidatePath("/dashboard");
}

export async function deleteTodo(id: string) {
  const supabase = await createClient();
  await supabase.from("personal_todos").delete().eq("id", id);
  revalidatePath("/dashboard");
}
