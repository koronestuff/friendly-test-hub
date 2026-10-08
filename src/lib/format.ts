export const ITEM_KINDS = [
  "hat",
  "hair",
  "face",
  "neck",
  "shoulder",
  "front",
  "back",
  "waist",
  "gear",
  "head",
  "torso",
  "arm",
  "leg",
] as const;

export const BODY_PART_KINDS = ["head", "torso", "arm", "leg"] as const;
export type BodyPartKind = (typeof BODY_PART_KINDS)[number];
export const isBodyPartKind = (k: string): k is BodyPartKind =>
  (BODY_PART_KINDS as readonly string[]).includes(k);

export type ItemKind = (typeof ITEM_KINDS)[number] | "shirt" | "pants" | "tshirt";
export type ItemClass = "normal" | "limited" | "limitedu";

export const CLASS_LABEL: Record<ItemClass, string> = {
  normal: "On Sale",
  limited: "Limited",
  limitedu: "Limited U",
};

export type Item = {
  id: string;
  name: string;
  kind: ItemKind;
  class: ItemClass;
  description: string;
  image_url: string | null;
  price: number;
  sale_ends_at: string | null;
  stock: number | null;
  copies_sold: number;
  rap: number;
  value: number;
  created_at: string;
  creator_id?: string | null;
  hidden?: boolean;
};

export function isLimitedNow(item: Pick<Item, "class" | "sale_ends_at" | "stock">) {
  if (item.class === "normal") return false;
  if (item.stock !== null && item.stock <= 0) return true;
  return !!item.sale_ends_at && new Date(item.sale_ends_at).getTime() <= Date.now();
}

export function formatCountdown(target: string | null) {
  if (!target) return "";
  const ms = new Date(target).getTime() - Date.now();
  if (ms <= 0) return "Sale ended";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return `${h}h ${m}m ${s}s`;
}

export function num(n: number) {
  return n.toLocaleString("en-US");
}

export function kindLabel(kind: string) {
  return kind === "tshirt" ? "T-Shirt" : kind === "shirt" ? "Shirt" : kind === "pants" ? "Pants" : kind;
}
