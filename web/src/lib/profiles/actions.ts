"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow, UserGroupRow, TaskTopicRow, AssigneeOption } from "@/types/profiles";

export async function fetchProfiles(): Promise<ProfileRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("display_name");
  if (error) {
    console.error("[profiles] fetchProfiles:", error.message);
    return [];
  }
  return (data ?? []) as ProfileRow[];
}

export async function fetchUserGroups(): Promise<UserGroupRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_groups")
    .select("*")
    .order("name");
  if (error) {
    console.error("[profiles] fetchUserGroups:", error.message);
    return [];
  }
  return (data ?? []) as UserGroupRow[];
}

const PROFILE_COLORS: Record<string, string> = {
  "Nina Eglinsky":    "#FFB3C6",
  "Andrea Herbig":    "#D4ADFC",
  "Christian Kessels":"#B3D4FF",
  "Konrad Schröter":  "#B3EFD4",
  "Marco Jordan":     "#FFE5B4",
  "Svetlana Gafler":  "#B3E8FF",
  "Info":             "#FFD6A5",
};

const HIDDEN_PROFILES = new Set(["Dastin Tot"]);

export async function fetchAssigneeOptions(): Promise<AssigneeOption[]> {
  const [profiles, groups] = await Promise.all([fetchProfiles(), fetchUserGroups()]);
  const options: AssigneeOption[] = [];

  for (const p of profiles) {
    if (!p.display_name) continue;
    if (HIDDEN_PROFILES.has(p.display_name)) continue;
    options.push({
      type: "profile",
      id: p.id,
      name: p.display_name,
      color: PROFILE_COLORS[p.display_name],
      avatarUrl: p.avatar_url,
    });
  }
  
  for (const g of groups) {
    options.push({
      type: "group",
      id: g.id,
      name: g.name,
      color: g.color,
    });
  }
  
  return options;
}

export async function updateProfile(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = z
    .object({
      id: z.string().uuid(),
      display_name: z.string().min(1).max(100).optional(),
      avatar_url: z.string().url().nullable().optional(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      ...(parsed.data.display_name && { display_name: parsed.data.display_name }),
      ...(parsed.data.avatar_url !== undefined && { avatar_url: parsed.data.avatar_url }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function createUserGroup(
  input: unknown
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const parsed = z
    .object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_groups")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description,
      color: parsed.data.color ?? "#579bfc",
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "Fehler" };
  revalidatePath("/");
  return { ok: true, id: data.id as string };
}

export async function fetchTaskTopics(departmentId: string): Promise<TaskTopicRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_topics")
    .select("*")
    .eq("department_id", departmentId)
    .order("sort_order")
    .order("name");
  if (error) {
    console.error("[profiles] fetchTaskTopics:", error.message);
    return [];
  }
  return (data ?? []) as TaskTopicRow[];
}

export async function createTaskTopic(
  input: unknown
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const parsed = z
    .object({
      department_id: z.string().uuid(),
      name: z.string().min(1).max(100),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_topics")
    .insert({
      department_id: parsed.data.department_id,
      name: parsed.data.name,
      color: parsed.data.color ?? "#00c875",
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "Fehler" };
  revalidatePath("/");
  return { ok: true, id: data.id as string };
}

export async function updateTaskTopic(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = z
    .object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100).optional(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const supabase = await createClient();
  const updateData: Record<string, unknown> = {};
  if (parsed.data.name) updateData.name = parsed.data.name;
  if (parsed.data.color) updateData.color = parsed.data.color;
  
  const { error } = await supabase
    .from("task_topics")
    .update(updateData)
    .eq("id", parsed.data.id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function deleteTaskTopic(
  id: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("task_topics").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/");
  return { ok: true };
}
