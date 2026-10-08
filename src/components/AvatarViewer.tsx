import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { AvatarColors, LoadedAccessory, WornClothing } from "@/components/Avatar3D";
import type { AccessoryMeta } from "@/lib/rbxm";

const Avatar3D = lazy(() => import("@/components/Avatar3D").then((m) => ({ default: m.Avatar3D })));

const DEFAULT_COLORS: AvatarColors = {
  head: "#F5CD30",
  torso: "#0D69AC",
  left_arm: "#F5CD30",
  right_arm: "#F5CD30",
  left_leg: "#A4BD47",
  right_leg: "#A4BD47",
};

const spinner = (
  <div className="flex h-full w-full items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

/**
 * Read-only view of someone's avatar. Shows the 2D render by default, with a 3D toggle,
 * exactly like the avatar editor.
 *
 * colors:   the player's saved skin colours (profile.avatar_colors)
 * equipped: the ids of the items they have equipped (profile.equipped_items)
 * ownedIds: optional; when given, items the player no longer owns (for example traded-away
 *           limiteds) are left out
 */
export function AvatarViewer({
  colors,
  equipped,
  ownedIds,
}: {
  colors?: Partial<AvatarColors> | null;
  equipped?: string[] | null;
  ownedIds?: string[];
}) {
  // The 3D scene only exists in the browser, so wait until the page has mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const merged = useMemo<AvatarColors>(() => ({ ...DEFAULT_COLORS, ...(colors ?? {}) }), [colors]);

  const ownedKey = ownedIds ? [...ownedIds].sort().join(",") : null;
  const ids = useMemo(() => {
    const owned = ownedKey !== null ? new Set(ownedKey ? ownedKey.split(",") : []) : null;
    return [...new Set(equipped ?? [])].filter((id) => !owned || owned.has(id)).sort();
  }, [equipped, ownedKey]);
  const idsKey = ids.join(",");

  const { data: accessories } = useQuery({
    queryKey: ["viewer-acc", idsKey],
    enabled: mounted && ids.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await supabase
        .from("item_accessories")
        .select("item_id, meta, mesh_b64, texture_data_url, item:items(kind)")
        .in("item_id", ids);
      return (data ?? []).map((r) => ({
        itemId: r.item_id,
        kind: (r.item as unknown as { kind: string } | null)?.kind ?? "hat",
        meta: r.meta as unknown as AccessoryMeta,
        mesh_b64: r.mesh_b64,
        texture_data_url: r.texture_data_url,
      })) as LoadedAccessory[];
    },
  });

  const { data: clothing } = useQuery({
    queryKey: ["viewer-clothing", idsKey],
    enabled: mounted && ids.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await supabase
        .from("clothing_templates")
        .select("item_id, template_data_url, item:items(kind)")
        .in("item_id", ids);
      return (data ?? []).map((r) => ({
        itemId: r.item_id,
        kind: (r.item as unknown as { kind: string } | null)?.kind,
        template: r.template_data_url,
      })) as WornClothing[];
    },
  });

  const shown = useMemo(() => (accessories ?? []).filter((a) => ids.includes(a.itemId)), [accessories, ids]);
  // Only items with a real 3D mesh go to the accessory renderer
  const meshAcc = useMemo(() => shown.filter((a) => !!a.mesh_b64), [shown]);
  // A worn "face" item with an image but no mesh replaces the default face
  const faceUrl = useMemo(
    () => shown.find((a) => a.kind === "face" && !a.mesh_b64 && a.texture_data_url)?.texture_data_url ?? null,
    [shown],
  );
  const worn = useMemo(() => (clothing ?? []).filter((c) => ids.includes(c.itemId)), [clothing, ids]);

  if (!mounted) return spinner;

  return (
    <Suspense fallback={spinner}>
      <Avatar3D colors={merged} accessories={meshAcc} clothing={worn} faceUrl={faceUrl} defaultView="2d" />
    </Suspense>
  );
}
