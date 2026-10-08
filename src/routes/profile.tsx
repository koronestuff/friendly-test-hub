import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { ItemCard } from "@/components/ItemCard";
import { RawbuxIcon } from "@/components/RawbuxIcon";
import { useAuth } from "@/lib/auth";
import { num, type Item } from "@/lib/format";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — Rawblox" },
      { name: "description", content: "Your Rawblox profile, description and collection." },
      { property: "og:title", content: "My Profile — Rawblox" },
      {
        property: "og:description",
        content: "Your Rawblox profile, description and collection.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile } = useAuth();

  const { data: items } = useQuery({
    queryKey: ["my-collection", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_items")
        .select("item_id")
        .eq("user_id", profile!.id);
      const ids = [...new Set((data ?? []).map((d) => d.item_id))];
      if (!ids.length) return [] as Item[];
      const { data: its } = await supabase.from("items").select("*").in("id", ids).limit(12);
      return (its ?? []) as Item[];
    },
  });

  if (!profile) return null;

  return (
    <AppLayout>
      <div className="rb-card p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-24 w-24 items-center justify-center rounded bg-surface text-3xl font-bold text-muted-foreground">
            {profile.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{profile.username}</h1>
            <p className="text-sm text-muted-foreground">
              Joined {new Date(profile.created_at).toLocaleDateString()}
            </p>
            <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold">
              <RawbuxIcon />
              {num(profile.rawbux)}
            </p>
          </div>
        </div>
        <div className="mt-5">
          <h2 className="rb-heading">About</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {profile.description || "You haven't written a description yet."}
          </p>
        </div>
      </div>

      <div className="rb-card mt-4 p-4">
        <h2 className="rb-heading">Collection</h2>
        {items && items.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {items.map((i) => (
              <ItemCard key={i.id} item={i} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">You don't own any items yet.</p>
        )}
      </div>
    </AppLayout>
  );
}
