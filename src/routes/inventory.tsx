import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { ItemThumb } from "@/components/ItemCard";
import { RawbuxIcon } from "@/components/RawbuxIcon";
import { useAuth } from "@/lib/auth";
import { CLASS_LABEL, num, type Item } from "@/lib/format";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — Rawblox" },
      { name: "description", content: "Every item you own on Rawblox, with serials and resales." },
      { property: "og:title", content: "Inventory — Rawblox" },
      {
        property: "og:description",
        content: "Every item you own on Rawblox, with serials and resales.",
      },
    ],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  const { profile } = useAuth();

  const { data } = useQuery({
    queryKey: ["inventory", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data: owned } = await supabase
        .from("user_items")
        .select("id, item_id, serial, sale_price, acquired_at")
        .eq("user_id", profile!.id)
        .order("acquired_at", { ascending: false });
      const ids = [...new Set((owned ?? []).map((o) => o.item_id))];
      const { data: its } = ids.length
        ? await supabase.from("items").select("*").in("id", ids)
        : { data: [] };
      const byId = new Map(((its ?? []) as Item[]).map((i) => [i.id, i]));
      return (owned ?? []).map((o) => ({ ...o, item: byId.get(o.item_id)! })).filter((o) => o.item);
    },
  });

  return (
    <AppLayout>
      <div className="rb-card p-4">
        <h1 className="rb-heading">Inventory</h1>
        {data && data.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {data.map((o) => (
              <Link
                key={o.id}
                to="/item/$itemId"
                params={{ itemId: o.item.id }}
                className="rb-card overflow-hidden hover:shadow-md"
              >
                <ItemThumb item={o.item} className="aspect-square" />
                <div className="border-t border-border p-2">
                  <div className="truncate text-sm font-semibold">{o.item.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {o.item.class === "normal" ? (
                      <span className="capitalize">{o.item.kind}</span>
                    ) : (
                      <>
                        {CLASS_LABEL[o.item.class]}
                        {o.serial ? ` #${o.serial}` : ""}
                      </>
                    )}
                  </div>
                  {o.sale_price !== null && (
                    <div className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-buy">
                      <RawbuxIcon /> On sale for {num(o.sale_price)}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            You don't own any items yet. Visit the catalog to get started.
          </p>
        )}
      </div>
    </AppLayout>
  );
}
