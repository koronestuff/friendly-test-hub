import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { rpcMessage } from "@/lib/social";
import { ItemThumb } from "@/components/ItemCard";
import { isLimitedNow, type Item } from "@/lib/format";

export const Route = createFileRoute("/trade_/new/$username")({
  head: () => ({
    meta: [
      { title: "Send a Trade — Rawblox" },
      { name: "description", content: "Build a trade offer with another Rawblox player." },
      { property: "og:title", content: "Send a Trade — Rawblox" },
      { property: "og:description", content: "Build a trade offer with another Rawblox player." },
    ],
  }),
  component: NewTradePage,
});

type Holding = { id: string; serial: number | null; item: Item };

async function loadHoldings(userId: string): Promise<Holding[]> {
  const { data } = await supabase
    .from("user_items")
    .select("id, serial, items(*)")
    .eq("user_id", userId);
  return ((data ?? []) as unknown as { id: string; serial: number | null; items: Item }[])
    .map((r) => ({ id: r.id, serial: r.serial, item: r.items }))
    .filter((r) => isLimitedNow(r.item));
}

function Picker({
  title,
  holdings,
  selected,
  toggle,
}: {
  title: string;
  holdings: Holding[];
  selected: string[];
  toggle: (id: string) => void;
}) {
  return (
    <div className="rb-card p-4">
      <h2 className="rb-heading">{title}</h2>
      {holdings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No limited items available. Only limited items can be traded.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {holdings.map((h) => {
            const on = selected.includes(h.id);
            return (
              <button
                key={h.id}
                onClick={() => toggle(h.id)}
                className={`overflow-hidden rounded-md border-2 text-left transition-colors ${
                  on ? "border-primary" : "border-border hover:border-muted-foreground"
                }`}
              >
                <ItemThumb item={h.item} className="aspect-square" />
                <div className="truncate px-1.5 py-1 text-[11px] font-semibold">{h.item.name}</div>
                {h.serial !== null && (
                  <div className="px-1.5 pb-1 text-[10px] text-muted-foreground">#{h.serial}</div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewTradePage() {
  const { username } = Route.useParams();
  const { session } = useAuth();
  const me = session?.user.id;
  const navigate = useNavigate();
  const [offer, setOffer] = useState<string[]>([]);
  const [request, setRequest] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const { data, isLoading } = useQuery({
    enabled: !!me,
    queryKey: ["trade-new", username, me],
    queryFn: async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("id, username, is_banned")
        .ilike("username", username)
        .maybeSingle();
      if (!p || p.is_banned) return null;
      const [mine, theirs] = await Promise.all([loadHoldings(me!), loadHoldings(p.id)]);
      return { target: p, mine, theirs };
    },
  });

  const toggle = (list: string[], set: (v: string[]) => void) => (id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  async function send() {
    if (!data) return;
    setSending(true);
    const msg = await rpcMessage(
      await supabase.rpc("create_trade", {
        _receiver: data.target.id,
        _offer: offer,
        _request: request,
      }),
    );
    setSending(false);
    if (msg !== "ok") {
      toast.error(msg);
      return;
    }
    toast.success("Trade sent.");
    void navigate({ to: "/trade" });
  }

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
        <div className="rb-card p-10 text-center">
          <h1 className="text-lg font-semibold">Page cannot be found or no longer exists</h1>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="rb-card mb-4 p-4">
        <h1 className="rb-heading mb-0">Send a trade to {data.target.username}</h1>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Picker
          title="Your items"
          holdings={data.mine}
          selected={offer}
          toggle={toggle(offer, setOffer)}
        />
        <Picker
          title={`${data.target.username}'s items`}
          holdings={data.theirs}
          selected={request}
          toggle={toggle(request, setRequest)}
        />
      </div>
      <div className="rb-card mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="text-sm text-muted-foreground">
          <p>
            Offering {offer.length} item(s) for {request.length} item(s).
          </p>
          {(() => {
            const sel = (ids: string[], hs: Holding[]) =>
              hs.filter((h) => ids.includes(h.id)).map((h) => h.item);
            const sum = (items: Item[], k: "rap" | "value") =>
              items.reduce((s, i) => s + (i[k] ?? 0), 0);
            const give = sel(offer, data.mine);
            const get = sel(request, data.theirs);
            const fmt = (n: number) =>
              `${n >= 0 ? "+" : "−"}${Math.abs(n).toLocaleString("en-US")}`;
            const rapDiff = sum(get, "rap") - sum(give, "rap");
            const valDiff = sum(get, "value") - sum(give, "value");
            const cls = (n: number) => (n >= 0 ? "text-buy" : "text-destructive");
            return (
              <p className="mt-1 text-xs font-semibold">
                You give: {sum(give, "rap").toLocaleString("en-US")} RAP ·{" "}
                {sum(give, "value").toLocaleString("en-US")} Value
                <span className="mx-2 text-border">|</span>
                You receive: {sum(get, "rap").toLocaleString("en-US")} RAP ·{" "}
                {sum(get, "value").toLocaleString("en-US")} Value
                <span className="mx-2 text-border">|</span>
                Net: <span className={cls(rapDiff)}>{fmt(rapDiff)} RAP</span> ·{" "}
                <span className={cls(valDiff)}>{fmt(valDiff)} Value</span>
              </p>
            );
          })()}
        </div>
        <button
          onClick={send}
          disabled={sending || offer.length === 0 || request.length === 0}
          className="rounded-md bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Send Trade
        </button>
      </div>
    </AppLayout>
  );
}
