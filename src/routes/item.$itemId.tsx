import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { ItemThumb } from "@/components/ItemCard";
import { RawbuxIcon } from "@/components/RawbuxIcon";
import { useAuth } from "@/lib/auth";
import { CLASS_LABEL, formatCountdown, isLimitedNow, kindLabel, num, type Item } from "@/lib/format";

export const Route = createFileRoute("/item/$itemId")({
  head: () => ({
    meta: [
      { title: "Item — Rawblox" },
      { name: "description", content: "View this Rawblox item, its owners, resellers and value." },
      { property: "og:title", content: "Item — Rawblox" },
      {
        property: "og:description",
        content: "View this Rawblox item, its owners, resellers and value.",
      },
    ],
  }),
  component: ItemPage,
});

type Owner = {
  id: string;
  user_id: string;
  serial: number | null;
  sale_price: number | null;
  username: string;
};

function ItemPage() {
  const { itemId } = Route.useParams();
  const { profile, refresh } = useAuth();
  const qc = useQueryClient();
  const [, tick] = useState(0);
  const [resalePrice, setResalePrice] = useState("");
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["item", itemId],
    queryFn: async () => {
      const { data: item } = await supabase.from("items").select("*").eq("id", itemId).maybeSingle();
      if (!item) return null;
      const { data: owned } = await supabase
        .from("user_items")
        .select("id, user_id, serial, sale_price")
        .eq("item_id", itemId)
        .order("serial", { ascending: true });
      const ids = [...new Set((owned ?? []).map((o) => o.user_id))];
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, username").in("id", ids)
        : { data: [] };
      const nameOf = new Map((profs ?? []).map((p) => [p.id, p.username]));
      const owners: Owner[] = (owned ?? []).map((o) => ({
        ...o,
        username: nameOf.get(o.user_id) ?? "Unknown",
      }));
      let creator: string | null = null;
      if (item.creator_id) {
        const { data: c } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", item.creator_id)
          .maybeSingle();
        creator = c?.username ?? "Unknown";
      }
      return { item: item as Item, owners, creator };
    },
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="rb-card p-8 text-center text-sm text-muted-foreground">Loading...</div>
      </AppLayout>
    );
  }
  if (!data) {
    return (
      <AppLayout>
        <div className="rb-card p-8 text-center text-sm">
          Page cannot be found or no longer exists
        </div>
      </AppLayout>
    );
  }

  const { item, owners, creator } = data;
  const limited = isLimitedNow(item);
  const resellers = owners
    .filter((o) => o.sale_price !== null)
    .sort((a, b) => (a.sale_price ?? 0) - (b.sale_price ?? 0));
  const cheapest = resellers[0]?.sale_price ?? null;
  const mine = owners.filter((o) => o.user_id === profile?.id);

  async function buy() {
    if (buying) return;
    setBuying(true);
    try {
      const { data: res, error } = await supabase.rpc("buy_item", { _item_id: itemId });
      if (error) {
        toast.error(error.message);
        return;
      }
      if (res === "ok") toast.success(`You bought ${item.name}!`);
      else toast.error(String(res));
      await refresh();
      await qc.invalidateQueries({ queryKey: ["item", itemId] });
    } finally {
      setBuying(false);
    }
  }

  async function list(userItemId: string, price: number | null) {
    const { data: res, error } = await supabase.rpc(
      "set_resale",
      { _user_item_id: userItemId, _price: price } as unknown as {
        _user_item_id: string;
        _price: number;
      },
    );
    if (error) {
      toast.error(error.message);
      return;
    }
    if (res === "ok") toast.success(price === null ? "Removed from sale." : "Item listed for sale.");
    else toast.error(String(res));
    setResalePrice("");
    await qc.invalidateQueries({ queryKey: ["item", itemId] });
  }

  return (
    <AppLayout>
      <div className="rb-card p-4">
        <div className="flex flex-col gap-6 md:flex-row">
          <ItemThumb item={item} className="aspect-square w-full rounded md:w-80" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">{item.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded bg-secondary px-2 py-0.5 font-semibold capitalize">
                {kindLabel(item.kind)}
              </span>
              {creator && (
                <span className="text-muted-foreground">
                  By{" "}
                  <Link
                    to="/users/$username"
                    params={{ username: creator }}
                    className="font-semibold text-primary hover:underline"
                  >
                    {creator}
                  </Link>
                </span>
              )}
              {item.class !== "normal" && (
                <span
                  className={`rounded px-2 py-0.5 font-bold text-primary-foreground ${
                    item.class === "limitedu" ? "bg-limitedu" : "bg-limited"
                  }`}
                >
                  {CLASS_LABEL[item.class]}
                </span>
              )}
              {!limited && item.class !== "normal" && item.sale_ends_at && (
                <span className="font-semibold text-destructive">
                  Goes limited in {formatCountdown(item.sale_ends_at)}
                </span>
              )}
              {!limited && item.class !== "normal" && item.stock !== null && (
                <span className="font-semibold text-muted-foreground">
                  Stock: {num(item.stock)} remaining
                </span>
              )}
            </div>

            <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
              {item.description || "No description."}
            </p>

            <div className="mt-5 rb-card p-4">
              {!limited ? (
                <>
                  <div className="text-xs font-semibold uppercase text-muted-foreground">Price</div>
                  <div className="flex items-center gap-1 text-2xl font-bold">
                    <RawbuxIcon className="h-5 w-5" />
                    {num(item.price)}
                  </div>
                  <button
                    onClick={buy}
                    disabled={buying}
                    className="mt-3 rounded-md bg-buy px-6 py-2 text-sm font-bold text-buy-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {buying ? "Buying..." : "Buy Now"}
                  </button>
                </>
              ) : cheapest !== null ? (
                <>
                  <div className="text-xs font-semibold uppercase text-muted-foreground">
                    Best price
                  </div>
                  <div className="flex items-center gap-1 text-2xl font-bold">
                    <RawbuxIcon className="h-5 w-5" />
                    {num(cheapest)}
                  </div>
                  <button
                    onClick={buy}
                    disabled={buying}
                    className="mt-3 rounded-md bg-buy px-6 py-2 text-sm font-bold text-buy-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {buying ? "Buying..." : "Buy Now"}
                  </button>
                </>
              ) : (
                <p className="text-sm font-semibold">No one is currently selling this item.</p>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="rb-card p-3">
                <div className="text-xs uppercase text-muted-foreground">Copies sold</div>
                <div className="font-bold">{num(item.copies_sold)}</div>
              </div>
              <div className="rb-card p-3">
                <div className="text-xs uppercase text-muted-foreground">Recent average price</div>
                <div className="flex items-center gap-1 font-bold">
                  <RawbuxIcon />
                  {num(item.rap)}
                </div>
              </div>
              <div className="rb-card p-3">
                <div className="text-xs uppercase text-muted-foreground">Value</div>
                <div className="flex items-center gap-1 font-bold">
                  <RawbuxIcon />
                  {num(item.value)}
                </div>
              </div>
              <div className="rb-card p-3">
                <div className="text-xs uppercase text-muted-foreground">Owners</div>
                <div className="font-bold">{num(owners.length)}</div>
              </div>
            </div>

            {limited && mine.length > 0 && (
              <div className="mt-4 rb-card p-4">
                <h2 className="mb-2 font-semibold">Your copies</h2>
                <div className="space-y-2">
                  {mine.map((o) => (
                    <div key={o.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold">
                        {o.serial ? `Serial #${o.serial}` : "Copy"}
                      </span>
                      {o.sale_price !== null ? (
                        <>
                          <span className="text-muted-foreground">
                            listed for {num(o.sale_price)}
                          </span>
                          <button
                            onClick={() => list(o.id, null)}
                            className="rounded border border-border px-2 py-1 text-xs font-semibold hover:bg-accent"
                          >
                            Take off sale
                          </button>
                        </>
                      ) : (
                        <>
                          <input
                            value={resalePrice}
                            onChange={(e) => setResalePrice(e.target.value)}
                            placeholder="Price"
                            className="h-8 w-24 rounded border border-input px-2 text-sm"
                          />
                          <button
                            onClick={() => list(o.id, Number(resalePrice) || 0)}
                            className="rounded bg-buy px-3 py-1.5 text-xs font-bold text-buy-foreground"
                          >
                            Sell
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <section>
            <h2 className="rb-heading">Resellers</h2>
            {resellers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No one is currently selling this item.
              </p>
            ) : (
              <ul className="space-y-1">
                {resellers.map((o) => (
                  <li key={o.id} className="flex items-center justify-between text-sm">
                    <Link
                      to="/users/$username"
                      params={{ username: o.username }}
                      className="font-semibold text-primary hover:underline"
                    >
                      {o.username}
                    </Link>
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <RawbuxIcon />
                      {num(o.sale_price ?? 0)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2 className="rb-heading">Owners</h2>
            {owners.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nobody owns this item yet.</p>
            ) : (
              <ul className="space-y-1">
                {owners.map((o) => (
                  <li key={o.id} className="flex items-center justify-between text-sm">
                    <Link
                      to="/users/$username"
                      params={{ username: o.username }}
                      className="font-semibold text-primary hover:underline"
                    >
                      {o.username}
                    </Link>
                    {o.serial && <span className="text-muted-foreground">#{o.serial}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
