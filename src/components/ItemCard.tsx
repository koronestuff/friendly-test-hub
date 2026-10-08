import { Link } from "@tanstack/react-router";
import { CLASS_LABEL, isLimitedNow, kindLabel, type Item } from "@/lib/format";
import { RawbuxIcon } from "@/components/RawbuxIcon";
import { ItemBadge } from "@/components/ItemBadge";

export function ItemThumb({ item, className = "" }: { item: Item; className?: string }) {
  return (
    <div className={`relative flex items-center justify-center bg-surface ${className}`}>
      {item.image_url ? (
        <img
          src={item.image_url}
          alt={item.name}
          loading="lazy"
          className="h-full w-full object-contain"
        />
      ) : (
        <span className="text-xs text-muted-foreground">No image</span>
      )}
      <ItemBadge cls={item.class} />
    </div>
  );
}

export function ItemCard({
  item,
  priceLabel,
  showValue,
  creator,
}: {
  item: Item;
  priceLabel?: string;
  showValue?: boolean;
  creator?: string | null;
}) {
  const limited = isLimitedNow(item);
  return (
    <Link
      to="/item/$itemId"
      params={{ itemId: item.id }}
      className="rb-card group overflow-hidden transition-shadow hover:shadow-md"
    >
      <ItemThumb item={item} className="aspect-square" />
      <div className="border-t border-border p-2">
        <div className="truncate text-sm font-semibold group-hover:text-primary">{item.name}</div>
        {creator && (
          <div className="truncate text-xs text-muted-foreground">
            By <span className="font-semibold text-primary">{creator}</span>
          </div>
        )}
        <div className="mt-0.5 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {item.class === "normal" ? (
              <span className="capitalize">{kindLabel(item.kind)}</span>
            ) : (
              <span
                className={`font-bold ${item.class === "limitedu" ? "text-limitedu" : "text-limited"}`}
              >
                {CLASS_LABEL[item.class]}
              </span>
            )}
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold">
            {priceLabel ? (
              <span className="text-xs text-muted-foreground">{priceLabel}</span>
            ) : (
              <>
                <RawbuxIcon />
                {showValue
                  ? item.value.toLocaleString("en-US")
                  : limited
                    ? item.rap.toLocaleString("en-US")
                    : item.price.toLocaleString("en-US")}
              </>
            )}
          </span>
        </div>
      </div>
    </Link>
  );
}
