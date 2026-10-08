export function ItemBadge({ cls }: { cls: string }) {
  if (cls !== "limited" && cls !== "limitedu") return null;
  const isU = cls === "limitedu";
  return (
    <img
      src={isU ? "/limited-u.png" : "/limited.png"}
      alt={isU ? "Limited U" : "Limited"}
      className="pointer-events-none absolute bottom-1 left-1 h-4 w-auto"
    />
  );
}
