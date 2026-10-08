import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchProfiles, rpcMessage } from "@/lib/social";
import { ItemThumb } from "@/components/ItemCard";
import type { Item } from "@/lib/format";

export const Route = createFileRoute("/trade")({
  head: () => ({
    meta: [
      { title: "Trades — Rawblox" },
      { name: "description", content: "Inbound, outbound, completed and inactive Rawblox trades." },
      { property: "og:title", content: "Trades — Rawblox" },
      {
        property: "og:description",
        content: "Inbound, outbound, completed and inactive Rawblox trades.",
      },
    ],
  }),
  component: TradePage,
});

const TABS = ["Inbound", "Outbound", "Completed", "Inactive"] as const;

type TradeRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  created_at: string;
};

function SideTotals({ items }: { items: Item[] }) {
  const rap = items.reduce((s, i) => s + (i.rap ?? 0), 0);
  const value = items.reduce((s, i) => s + (i.value ?? 0), 0);
  return (
    <p className="mt-1 text-xs font-semibold text-muted-foreground">
      RAP: {rap.toLocaleString("en-US")} · Value: {value.toLocaleString("en-US")}
    </p>
  );
}

function NetLine({ give, receive }: { give: Item[]; receive: Item[] }) {
  const rapDiff =
    receive.reduce((s, i) => s + (i.rap ?? 0), 0) - give.reduce((s, i) => s + (i.rap ?? 0), 0);
  const valueDiff =
    receive.reduce((s, i) => s + (i.value ?? 0), 0) -
    give.reduce((s, i) => s + (i.value ?? 0), 0);
  const fmt = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toLocaleString("en-US")}`;
  const cls = (n: number) => (n >= 0 ? "text-buy" : "text-destructive");
  return (
    <p className="mt-2 border-t border-border pt-2 text-xs font-bold">
      You {rapDiff >= 0 && valueDiff >= 0 ? "earn" : rapDiff <= 0 && valueDiff <= 0 ? "lose" : "net"}
      : <span className={cls(rapDiff)}>{fmt(rapDiff)} RAP</span> ·{" "}
      <span className={cls(valueDiff)}>{fmt(valueDiff)} Value</span>
    </p>
  );
}

function ItemStrip({ items }: { items: Item[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i, idx) => (
        <div key={`${i.id}-${idx}`} className="w-20">
          <ItemThumb item={i} className="aspect-square rounded border border-border" />
          <div className="truncate text-[11px] text-muted-foreground">{i.name}</div>
        </div>
      ))}
    </div>
  );
}

function TradePage() {
  const [tab, setTab] = useState<string>(TABS[0]);
  const { session } = useAuth();
  const me = session?.user.id;
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    enabled: !!me,
    queryKey: ["trades", me],
    queryFn: async () => {
      const { data: trades } = await supabase
        .from("trades")
        .select("id, sender_id, receiver_id, status, created_at")
        .order("created_at", { ascending: false });
      const list = (trades ?? []) as TradeRow[];
      const { data: tItems } = list.length
        ? await supabase
            .from("trade_items")
            .select("trade_id, side, items(*)")
            .in(
              "trade_id",
              list.map((t) => t.id),
            )
        : { data: [] };
      const profiles = await fetchProfiles(list.flatMap((t) => [t.sender_id, t.receiver_id]));
      return { list, tItems: (tItems ?? []) as never[], profiles };
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["trades"] });

  async function respond(id: string, accept: boolean) {
    const msg = await rpcMessage(await supabase.rpc("respond_trade", { _trade_id: id, _accept: accept }));
    if (msg !== "ok") toast.error(msg);
    else toast.success(accept ? "Trade accepted." : "Trade declined.");
    refresh();
    qc.invalidateQueries({ queryKey: ["inventory"] });
  }

  async function cancel(id: string) {
    const msg = await rpcMessage(await supabase.rpc("cancel_trade", { _trade_id: id }));
    if (msg !== "ok") toast.error(msg);
    else toast.success("Trade cancelled.");
    refresh();
  }

  const all = data?.list ?? [];
  const visible = all.filter((t) => {
    if (tab === "Inbound") return t.status === "pending" && t.receiver_id === me;
    if (tab === "Outbound") return t.status === "pending" && t.sender_id === me;
    if (tab === "Completed") return t.status === "accepted";
    return t.status === "declined" || t.status === "cancelled";
  });

  function sideItems(tradeId: string, side: "offer" | "request") {
    return ((data?.tItems ?? []) as unknown as { trade_id: string; side: string; items: Item }[])
      .filter((r) => r.trade_id === tradeId && r.side === side)
      .map((r) => r.items);
  }

  return (
    <AppLayout>
      <div className="rb-card p-4">
        <h1 className="rb-heading">Trades</h1>
        <div className="mb-4 flex flex-wrap gap-2 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
                tab === t
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading...</p>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            You have no {tab.toLowerCase()} trades.
          </p>
        ) : (
          <div className="space-y-4">
            {visible.map((t) => {
              const other = t.sender_id === me ? t.receiver_id : t.sender_id;
              const otherName = data?.profiles[other]?.username ?? "Unknown";
              const yourItems = sideItems(t.id, t.sender_id === me ? "offer" : "request");
              const theirItems = sideItems(t.id, t.sender_id === me ? "request" : "offer");
              return (
                <div key={t.id} className="rounded-md border border-border p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      Trade with{" "}
                      <Link
                        to="/users/$username"
                        params={{ username: otherName }}
                        className="text-primary hover:underline"
                      >
                        {otherName}
                      </Link>
                      <span className="ml-2 text-xs font-normal capitalize text-muted-foreground">
                        {t.status} · {new Date(t.created_at).toLocaleDateString()}
                      </span>
                    </p>
                    {t.status === "pending" && (
                      <div className="flex gap-2">
                        {t.receiver_id === me ? (
                          <>
                            <button
                              onClick={() => respond(t.id, true)}
                              className="rounded-md bg-buy px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => respond(t.id, false)}
                              className="rounded-md border border-border px-3 py-1.5 text-xs font-bold hover:bg-surface"
                            >
                              Decline
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => cancel(t.id)}
                            className="rounded-md border border-border px-3 py-1.5 text-xs font-bold hover:bg-surface"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-bold uppercase text-muted-foreground">
                        You give
                      </p>
                      <ItemStrip items={yourItems} />
                      <SideTotals items={yourItems} />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-bold uppercase text-muted-foreground">
                        You receive
                      </p>
                      <ItemStrip items={theirItems} />
                      <SideTotals items={theirItems} />
                    </div>
                  </div>
                  <NetLine give={yourItems} receive={theirItems} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
