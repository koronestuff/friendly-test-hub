import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Returns the internal sign-in address for a username (handles renamed accounts,
// whose sign-in address still reflects the original username).
export const resolveLoginEmail = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ username: z.string().trim().min(3).max(20) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("username", data.username)
      .maybeSingle();
    if (!prof) return { email: null as string | null };
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(prof.id);
    return { email: u.user?.email ?? null };
  });
