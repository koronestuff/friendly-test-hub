import { supabase } from "@/integrations/supabase/client";

export type MiniProfile = { id: string; username: string };

export async function fetchProfiles(ids: string[]): Promise<Record<string, MiniProfile>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return {};
  const { data } = await supabase.from("profiles").select("id, username").in("id", unique);
  const map: Record<string, MiniProfile> = {};
  for (const p of data ?? []) map[p.id] = p;
  return map;
}

export async function rpcMessage(result: { data: unknown; error: { message: string } | null }) {
  if (result.error) return result.error.message;
  return (result.data as string) ?? "ok";
}
