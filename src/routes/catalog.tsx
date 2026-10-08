import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { ItemCard } from "@/components/ItemCard";
import { ITEM_KINDS, kindLabel, type Item } from "@/lib/format";
import { CLOTHING_KINDS } from "@/lib/clothing";

export const Route = createFileRoute("/catalog")({
  head: () => ({
    meta: [
      { title: "Catalog — Rawblox" },
      {
        name: "description",
        content: "Browse every hat, hair, face and gear item on Rawblox, including limiteds.",
      },
      { property: "og:title", content: "Catalog — Rawblox" },
      {
        property: "og:description",
        content: "Browse every hat, hair, face and gear item on Rawblox, including limiteds.",
      },
    ],
  }),
  component: CatalogPage,
});

const FILTERS = [
  { key: "all", label: "All" },
  { key: "normal", label: "On Sale" },
  { key: "limited", label: "Limited" },
  { key: "limitedu", label: "Limited U" },
  { key: "offsale", label: "Offsale" },
  { key: "clothing", label: "Clothing" },
] as const;

function CatalogPage() {
  const [cls, setCls] = useState<string>("all");
  const [kind, setKind] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState(""); // the search text actually used for the query

  // Wait a moment after typing stops before searching, so we don't query on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setTerm(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: items, isLoading } = useQuery({
    queryKey: ["catalog", cls, kind, term],
    staleTime: 60 * 1000,
    queryFn: async () => {
      let q = supabase.from("items").select("*").eq("hidden", false).order("created_at", { ascending: false });
      if (cls === "clothing") q = q.in("kind", [...CLOTHING_KINDS]);
      else {
        q = q.not("kind", "in", `(${CLOTHING_KINDS.join(",")})`);
        if (cls !== "all") q = q.eq("class", cls as "normal");
      }
      if (kind !== "all") q = q.eq("kind", kind as "hat");
      // Search by name (case-insensitive); escape the characters that have a special meaning in patterns
      if (term) q = q.ilike("name", `%${term.replace(/[\\%_]/g, "\\$&")}%`);
      const { data } = await q;
      const list = (data ?? []) as Item[];
      const ids = [...new Set(list.map((i) => i.creator_id).filter(Boolean))] as string[];
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, username").in("id", ids)
        : { data: [] };
      const names = new Map((profs ?? []).map((p) => [p.id, p.username]));
      return list.map((i) => ({ item: i, creator: i.creator_id ? names.get(i.creator_id) ?? "Unknown" : null }));
    },
  });

  return (
    <AppLayout>
      <div className="rb-card p-4">
        <h1 className="rb-heading">Catalog</h1>

        <div className="relative mb-3 max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items"
            maxLength={50}
            className="h-9 w-full rounded-md border border-input bg-card pl-8 pr-8 text-sm outline-none focus:border-primary"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setCls(f.key);
                setKind("all");
              }}
              className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${
                cls === f.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-accent"
              }`}
            >
              {f.label}
            </button>
          ))}
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="ml-auto h-9 rounded-md border border-input bg-card px-2 text-sm capitalize outline-none"
          >
            <option value="all">All types</option>
            {(cls === "clothing" ? CLOTHING_KINDS : ITEM_KINDS).map((k) => (
              <option key={k} value={k} className="capitalize">
                {kindLabel(k)}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>
        ) : items && items.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {items.map(({ item: i, creator }) => (
              <ItemCard key={i.id} item={i} creator={creator} />
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {term ? `No items found for "${term}".` : "No items found."}
          </p>
        )}
      </div>
    </AppLayout>
  );
}
