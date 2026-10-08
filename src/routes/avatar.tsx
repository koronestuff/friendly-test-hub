import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { ITEM_KINDS, isBodyPartKind, type Item } from "@/lib/format";
import type { AvatarColors, LoadedAccessory, WornClothing } from "@/components/Avatar3D";
import { CLOTHING_KINDS, isClothingKind } from "@/lib/clothing";
import type { AccessoryMeta } from "@/lib/rbxm";

const Avatar3D = lazy(() => import("@/components/Avatar3D").then((m) => ({ default: m.Avatar3D })));

export const Route = createFileRoute("/avatar")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Avatar — Rawrion Economy Simulator" },
      { name: "description", content: "Customize your 3D avatar, skin tone and accessories." },
      { property: "og:title", content: "Avatar — Rawrion Economy Simulator" },
      { property: "og:description", content: "Customize your 3D avatar, skin tone and accessories." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AvatarPage,
});

const DEFAULT_COLORS: AvatarColors = {
  head: "#F5CD30",
  torso: "#0D69AC",
  left_arm: "#F5CD30",
  right_arm: "#F5CD30",
  left_leg: "#A4BD47",
  right_leg: "#A4BD47",
};

// Classic BrickColor skin-tone palette
const PALETTE = [
  "#F2F3F3", "#E5E4DF", "#A3A2A5", "#635F62", "#1B2A35", "#000000",
  "#CC8E69", "#EAB892", "#D7C59A", "#F5CD30", "#FFC9C9", "#F8D96D",
  "#A05F35", "#7C5C46", "#694028", "#56423A", "#C4281C", "#DA8541",
  "#E8BAC8", "#FF66CC", "#B480FF", "#6B327C", "#0D69AC", "#6E99CA",
  "#80BBDB", "#B4D2E4", "#00FFFF", "#A4BD47", "#4B974B", "#287F47",
  "#27462D", "#FDEA8D",
];

const PARTS: { key: keyof AvatarColors; label: string }[] = [
  { key: "head", label: "Head" },
  { key: "torso", label: "Torso" },
  { key: "left_arm", label: "Left Arm" },
  { key: "right_arm", label: "Right Arm" },
  { key: "left_leg", label: "Left Leg" },
  { key: "right_leg", label: "Right Leg" },
];

function AvatarPage() {
  const { profile, session, refresh } = useAuth();
  const uid = session?.user.id;
  const [colors, setColors] = useState<AvatarColors>(DEFAULT_COLORS);
  const [equipped, setEquipped] = useState<string[]>([]);
  const [tab, setTab] = useState<"accessories" | "body">("accessories");
  const [kind, setKind] = useState<string>("all");
  const [advanced, setAdvanced] = useState(false);
  const [part, setPart] = useState<keyof AvatarColors>("head");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const p = profile as unknown as { avatar_colors?: AvatarColors; equipped_items?: string[] };
    setColors({ ...DEFAULT_COLORS, ...(p.avatar_colors ?? {}) });
    setEquipped(p.equipped_items ?? []);
  }, [profile]);

  const { data: owned, isLoading } = useQuery({
    queryKey: ["avatar-owned", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_items").select("item:items(*)").eq("user_id", uid!);
      if (error) throw error;
      const map = new Map<string, Item>();
      for (const r of (data ?? []) as unknown as { item: Item | null }[]) if (r.item) map.set(r.item.id, r.item);
      const items = [...map.values()];
      
      const { data: acc } = await supabase
    .from("item_accessories")
    .select("item_id, meta")
    .in("item_id", items.length ? items.map((i) => i.id) : ["00000000-0000-0000-0000-000000000000"]);

  const has3d = new Set((acc ?? []).map((a) => a.item_id));
  // Rows with no attachment data are flat face images
  const faceImages = new Set(
    (acc ?? [])
      .filter((a) => !(a.meta as unknown as AccessoryMeta | null)?.attachmentPos)
      .map((a) => a.item_id),
  );
  return items.map((i) => ({
    ...i,
    has3d: has3d.has(i.id),
    isFaceImage: i.kind === "face" && faceImages.has(i.id),
    }));
  },    
  });

  // Drop equipped items the user no longer owns (e.g. traded limiteds)
  useEffect(() => {
    if (!owned) return;
    const ownedIds = new Set(owned.map((i) => i.id));
    const stale = equipped.filter((id) => !ownedIds.has(id));
    if (stale.length === 0) return;
    setEquipped((e) => e.filter((id) => ownedIds.has(id)));
    toast.info(
      stale.length === 1
        ? "An item was removed from your avatar because you no longer own it."
        : `${stale.length} items were removed from your avatar because you no longer own them.`,
    );
  }, [owned, equipped]);

  const { data: accessories } = useQuery({
    queryKey: ["avatar-acc", [...equipped].sort().join(",")],
    enabled: equipped.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("item_accessories")
        .select("item_id, meta, mesh_b64, texture_data_url, item:items(kind)")
        .in("item_id", equipped);
      return (data ?? []).map((r) => ({
        itemId: r.item_id,
        kind: (r.item as unknown as { kind: string } | null)?.kind ?? "hat",
        meta: r.meta as unknown as AccessoryMeta,
        mesh_b64: r.mesh_b64,
        texture_data_url: r.texture_data_url,
      })) as LoadedAccessory[];
    },
  });

  // Only show equipped items in the 3D preview, and only ones the user still owns
  const visibleAcc = useMemo(() => {
    const ownedIds = owned ? new Set(owned.map((i) => i.id)) : null;
    return (accessories ?? []).filter(
      (a) => equipped.includes(a.itemId) && (!ownedIds || ownedIds.has(a.itemId)),
    );
  }, [accessories, equipped, owned]);

  // A worn "face" item with a texture but no 3D mesh is a flat face image that
  // replaces the default face on the head.
  const faceUrl = useMemo(
    () =>
      visibleAcc.find((a) => a.kind === "face" && !a.mesh_b64 && a.texture_data_url)?.texture_data_url ?? null,
    [visibleAcc],
  );

  // Face images have no mesh, so keep them out of the 3D accessory list
  const meshAcc = useMemo(() => visibleAcc.filter((a) => !!a.mesh_b64), [visibleAcc]);

  const wornIds = (owned ?? [])
    .filter((i) => equipped.includes(i.id) && isClothingKind(i.kind))
    .map((i) => i.id)
    .sort();
  const { data: clothing } = useQuery({
    queryKey: ["avatar-clothing", wornIds.join(",")],
    enabled: wornIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("clothing_templates")
        .select("item_id, template_data_url, item:items(kind)")
        .in("item_id", wornIds);
      return (data ?? []).map((r) => ({
        itemId: r.item_id,
        kind: (r.item as unknown as { kind: string } | null)?.kind,
        template: r.template_data_url,
      })) as WornClothing[];
    },
  });
  const visibleClothing = (clothing ?? []).filter((c) => wornIds.includes(c.itemId));

  const list = (owned ?? []).filter((i) => kind === "all" || i.kind === kind);
// Items that compete for the same slot: one shirt, one pants, one t-shirt, one face image.
// 3D face accessories (shades, masks...) have no slot, so they stack.
const slotOf = (i?: { kind: string; isFaceImage?: boolean }) =>
  !i ? null
  : isClothingKind(i.kind) || isBodyPartKind(i.kind) ? i.kind
  : i.isFaceImage ? "face-image"
  : null;

const toggle = (id: string) => {
  const it = owned?.find((i) => i.id === id);
  setEquipped((e) => {
    if (e.includes(id)) return e.filter((x) => x !== id);
    const slot = slotOf(it);
    const rest = slot
      ? e.filter((x) => slotOf(owned?.find((o) => o.id === x)) !== slot)
      : e;
    return rest.length >= 100 ? rest : [...rest, id];
  });
};

  const pickColor = (c: string) =>
    setColors((prev) =>
      advanced
        ? { ...prev, [part]: c }
        : { head: c, torso: c, left_arm: c, right_arm: c, left_leg: c, right_leg: c },
    );

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.rpc("save_avatar", {
      _colors: colors as unknown as never,
      _equipped: equipped,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Avatar saved!");
      await refresh();
    }
  };

  return (
    <AppLayout>
      <div className="rb-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="rb-heading mb-0">Avatar Editor</h1>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="h-[420px] overflow-hidden rounded-md border border-border bg-muted">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              }
            >
              <Avatar3D
                colors={colors}
                accessories={meshAcc}
                clothing={visibleClothing}
                faceUrl={faceUrl}
              />
            </Suspense>
          </div>

          <div>
            <div className="mb-3 flex gap-1 border-b border-border">
              {(["accessories", "body"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm font-bold ${tab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
                >
                  {t === "accessories" ? "Accessories" : "Body / Skin Tone"}
                </button>
              ))}
            </div>

            {tab === "accessories" ? (
              <>
                <div className="mb-3 flex flex-wrap gap-1">
                  {["all", ...ITEM_KINDS, ...CLOTHING_KINDS].map((k) => (
                    <button
                      key={k}
                      onClick={() => setKind(k)}
                      className={`rounded-full border px-3 py-0.5 text-xs font-bold capitalize ${kind === k ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent"}`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                {isLoading ? (
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                ) : list.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    You don't own any items here yet. <Link to="/catalog" className="text-primary underline">Visit the catalog</Link>.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {list.map((i) => {
                      const on = equipped.includes(i.id);
                      return (
                        <button
                          key={i.id}
                          onClick={() => toggle(i.id)}
                          className={`relative rounded-md border p-1 text-left ${on ? "border-primary ring-2 ring-primary" : "border-border hover:bg-accent"}`}
                        >
                          <div className="aspect-square overflow-hidden rounded bg-muted">
                            {i.image_url && <img src={i.image_url} alt={i.name} className="h-full w-full object-contain" />}
                          </div>
                          <p className="mt-1 truncate text-xs font-bold">{i.name}</p>
                          {on && (
                            <span className="absolute left-1 top-1 rounded bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                              Equipped
                            </span>
                          )}
                          {!i.has3d && !isClothingKind(i.kind) && (
                            <span className="absolute right-1 top-1 rounded bg-card px-1 text-[10px] text-muted-foreground">
                              No 3D
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div>
                <label className="mb-3 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} />
                  Advanced (color each body part)
                </label>
                {advanced && (
                  <div className="mb-3 flex flex-wrap gap-1">
                    {PARTS.map((p) => (
                      <button
                        key={p.key}
                        onClick={() => setPart(p.key)}
                        className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold ${part === p.key ? "border-primary" : "border-border"}`}
                      >
                        <span className="h-3 w-3 rounded-sm border border-border" style={{ background: colors[p.key] }} />
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-8 gap-1.5">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      title={c}
                      onClick={() => pickColor(c)}
                      className="aspect-square rounded-full border-2 border-border hover:scale-110"
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
