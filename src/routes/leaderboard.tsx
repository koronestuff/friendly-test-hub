import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { RawbuxIcon } from "@/components/RawbuxIcon";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Rawrion Economy Simulator" },
      {
        name: "description",
        content: "See which players hold the most valuable inventories, ranked by total value.",
      },
      { property: "og:title", content: "Leaderboard — Rawrion Economy Simulator" },
      {
        property: "og:description",
        content: "See which players hold the most valuable inventories, ranked by total value.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeaderboardPage,
});

type Row = { id: string; username: string; rap: number; value: number; items: number };

async function fetchAllOwned() {
  const pageSize = 1000;
  const all: { user_id: string; items: { rap: number; value: number } | null }[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("user_items")
      .select("user_id, items(rap, value)")
      .order("id") // use any unique column so pages don't overlap
      .range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...((data ?? []) as unknown as typeof all));
    if (!data || data.length < pageSize) break;
  }
  return all;
}

function LeaderboardPage() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    void (async () => {
      const [{ data: profiles }, owned] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username")
          .eq("is_banned", false)
          .eq("inventory_private", false)
          .limit(1000),
        fetchAllOwned(),
      ]);
      const totals = new Map<string, { rap: number; value: number; items: number }>();
      for (const row of owned) {
        const item = row.items;
        const rap = item?.rap ?? 0;
        const value = item?.value ?? 0;
        const cur = totals.get(row.user_id) ?? { rap: 0, value: 0, items: 0 };
        totals.set(row.user_id, { rap: cur.rap + rap, value: cur.value + value, items: cur.items + 1 });
      }
      const list = (profiles ?? []).map((p) => ({
        id: p.id,
        username: p.username,
        rap: totals.get(p.id)?.rap ?? 0,
        value: totals.get(p.id)?.value ?? 0,
        items: totals.get(p.id)?.items ?? 0,
      }));
      list.sort((a, b) => b.value - a.value || b.rap - a.rap || a.username.localeCompare(b.username));
      setRows(list);
    })();
  }, []);

  return (
    <AppLayout>
      <div className="rb-card p-5">
        <h1 className="rb-heading">Leaderboard</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Players ranked by the total value of every item they own.
        </p>

        {rows === null ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No players yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r, i) => (
              <li key={r.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="w-8 text-right font-bold text-muted-foreground">#{i + 1}</span>
                <Link
                  to="/users/$username"
                  params={{ username: r.username }}
                  className="font-bold text-primary hover:underline"
                >
                  {r.username}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {r.items} item{r.items === 1 ? "" : "s"}
                </span>
                <span className="ml-auto inline-flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 font-bold" title="Total value">
                    <RawbuxIcon className="h-4 w-4" />
                    {r.value.toLocaleString("en-US")}
                  </span>
                  <span className="inline-flex items-center gap-1 font-bold text-muted-foreground" title="Total RAP">
                    <RawbuxIcon className="h-4 w-4" />
                    {r.rap.toLocaleString("en-US")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  );
}
