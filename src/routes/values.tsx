import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { ItemCard } from "@/components/ItemCard";
import { type Item } from "@/lib/format";

export const Route = createFileRoute("/values")({
  head: () => ({
    meta: [
      { title: "Values — Rawrion Economy Simulator" },
      {
        name: "description",
        content: "Browse every item ranked by value, from the most valuable to the least.",
      },
      { property: "og:title", content: "Values — Rawrion Economy Simulator" },
      {
        property: "og:description",
        content: "Browse every item ranked by value, from the most valuable to the least.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ValuesPage,
});

function ValuesPage() {
  const { data: items, isLoading } = useQuery({
    queryKey: ["values"],
    queryFn: async () => {
      const { data } = await supabase
        .from("items")
        .select("*")
        .eq("hidden", false)
        .order("value", { ascending: false })
        .order("rap", { ascending: false });
      return (data ?? []) as Item[];
    },
  });

  return (
    <AppLayout>
      <div className="rb-card p-4">
        <h1 className="rb-heading">Values</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Every item ranked from most valuable to least valuable.
        </p>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items && items.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {items.map((i) => (
              <ItemCard key={i.id} item={i} showValue />
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">No items found.</p>
        )}
      </div>
    </AppLayout>
  );
}
