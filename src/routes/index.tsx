import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { ItemCard } from "@/components/ItemCard";
import { useAuth } from "@/lib/auth";
import type { Item } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rawblox — Home" },
      {
        name: "description",
        content: "Your Rawblox home: newest catalog items, your Rawbux and your collection.",
      },
      { property: "og:title", content: "Rawblox — Home" },
      {
        property: "og:description",
        content: "Your Rawblox home: newest catalog items, your Rawbux and your collection.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { profile } = useAuth();
  const { data: items } = useQuery({
    queryKey: ["home-items"],
    queryFn: async () => {
      const { data } = await supabase
        .from("items")
        .select("*")
        .eq("hidden", false)
        .order("created_at", { ascending: false })
        .limit(12);
      return (data ?? []) as Item[];
    },
  });

  return (
    <AppLayout>
      <div className="rb-card mb-4 p-5">
        <h1 className="text-2xl font-bold">
          Welcome back{profile ? `, ${profile.username}` : ""}!
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You collect 100 free Rawribux every 24 hours just for logging in.
        </p>
      </div>

      <section className="rb-card p-4">
        <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
          <h2 className="text-lg font-semibold">Recently Uploaded Items</h2>
          <Link to="/catalog" className="text-sm font-semibold text-primary hover:underline">
            See all
          </Link>
        </div>
        {items && items.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {items.map((i) => (
              <ItemCard key={i.id} item={i} />
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No items have been uploaded yet.
          </p>
        )}
      </section>
    </AppLayout>
  );
}
