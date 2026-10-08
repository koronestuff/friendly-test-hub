import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import {
  adminBanUser,
  adminCreatePromocode,
  adminDeleteItem,
  adminEditItem,
  adminSetAccessory,
  adminSetFace,
  adminSetBodyPart,
  adminRemoveAccessory,
  adminFindUser,
  adminGetInventory,
  adminGiveItem,
  adminGrantRawbux,
  adminRemoveUserItem,
  adminResetRawbux,
  adminResetPassword,
  adminListItems,
  adminListPromocodes,
  adminLogin,
  adminLogout,
  adminRestockItem,
  adminSetItemHidden,
  adminSetItemRap,
  adminSetItemValue,
  adminSetPromocodeActive,
  adminStatus,
  adminUnbanUser,
  publishItem,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Panel — Rawblox" },
      { name: "description", content: "Restricted Rawblox administration tools." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Admin Panel — Rawblox" },
      { property: "og:description", content: "Restricted Rawblox administration tools." },
    ],
  }),
  component: AdminPage,
});

const KINDS = ["hat", "hair", "face", "neck", "shoulder", "front", "back", "waist", "gear", "head", "torso", "arm", "leg"];
const BODY_KINDS = ["head", "torso", "arm", "leg"];
const DURATIONS = [
  ["1d", "1 Day"],
  ["3d", "3 Days"],
  ["7d", "7 Days"],
  ["14d", "14 Days"],
  ["1mo", "1 Month"],
  ["6mo", "6 Months"],
  ["1y", "1 Year"],
  ["perm", "Permanent"],
];

type FoundUser = {
  id: string;
  username: string;
  rawbux: number;
  is_banned: boolean;
  ban_reason: string | null;
  ban_until: string | null;
};

type Promocode = {
  id: string;
  code: string;
  rawbux_reward: number;
  item_id: string | null;
  max_uses: number | null;
  uses: number;
  expires_at: string | null;
  is_active: boolean;
};

type AdminItem = {
  id: string;
  name: string;
  kind: string;
  class: string;
  price: number;
  copies_sold: number;
  rap: number;
  value: number;
  stock: number | null;
  sale_ends_at: string | null;
  description: string;
  hidden: boolean;
};

type InventoryRow = {
  id: string;
  serial: number | null;
  sale_price: number | null;
  items: { id: string; name: string; kind: string; class: string } | null;
};

function AdminPage() {
  const status = useServerFn(adminStatus);
  const login = useServerFn(adminLogin);
  const logout = useServerFn(adminLogout);
  const publish = useServerFn(publishItem);
  const findUser = useServerFn(adminFindUser);
  const ban = useServerFn(adminBanUser);
  const unban = useServerFn(adminUnbanUser);
  const grant = useServerFn(adminGrantRawbux);
  const resetRawbux = useServerFn(adminResetRawbux);
  const resetPassword = useServerFn(adminResetPassword);
  const listCodes = useServerFn(adminListPromocodes);
  const createCode = useServerFn(adminCreatePromocode);
  const setCodeActive = useServerFn(adminSetPromocodeActive);
  const listItems = useServerFn(adminListItems);
  const deleteItem = useServerFn(adminDeleteItem);
  const getInventory = useServerFn(adminGetInventory);
  const giveItem = useServerFn(adminGiveItem);
  const removeUserItem = useServerFn(adminRemoveUserItem);

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");

  const [name, setName] = useState("");
  const [kind, setKind] = useState(KINDS[0]!);
  const [cls, setCls] = useState<"normal" | "limited" | "limitedu" | "offsale">("normal");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [price, setPrice] = useState("100");
  const [timerH, setTimerH] = useState("24");
  const [timerM, setTimerM] = useState("0");
  const [timerS, setTimerS] = useState("0");
  const [stock, setStock] = useState("");
  const [itemValue, setItemValue] = useState("");
  const [hidden, setHidden] = useState(false);

  const [search, setSearch] = useState("");
  const [user, setUser] = useState<FoundUser | null>(null);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("1d");
  const [amount, setAmount] = useState("100");
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [giveItemId, setGiveItemId] = useState("");

  const [code, setCode] = useState("");
  const [codeRawbux, setCodeRawbux] = useState("100");
  const [codeItem, setCodeItem] = useState("");
  const [codeMax, setCodeMax] = useState("");
  const [codeDays, setCodeDays] = useState("");
  const [codes, setCodes] = useState<Promocode[]>([]);
  const [itemOptions, setItemOptions] = useState<AdminItem[]>([]);

  useEffect(() => {
    status().then((r) => setAuthed(r.admin));
  }, [status]);

  const reloadCodes = useCallback(async () => {
    setCodes((await listCodes()) as Promocode[]);
  }, [listCodes]);

  const reloadItems = useCallback(async () => {
    setItemOptions((await listItems()) as AdminItem[]);
  }, [listItems]);

  useEffect(() => {
    if (!authed) return;
    void reloadCodes();
    void reloadItems();
  }, [authed, reloadCodes, reloadItems]);

  async function doCreateCode() {
    try {
      await createCode({
        data: {
          code,
          rawbux: Number(codeRawbux) || 0,
          itemId: codeItem || null,
          maxUses: codeMax ? Number(codeMax) : null,
          expiresInDays: codeDays ? Number(codeDays) : null,
        },
      });
      toast.success("Promocode created.");
      setCode("");
      await reloadCodes();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function doLogin() {
    const r = await login({ data: { password: pw } });
    if (!r.ok) {
      toast.error("Incorrect password.");
      return;
    }
    // Confirm the admin session cookie actually stuck before showing the panel.
    const check = await status();
    if (!check.admin) {
      toast.error("Could not start an admin session. Try opening the preview in a new tab.");
      return;
    }
    setAuthed(true);
    setPw("");
  }

  async function doPublish() {
    try {
      await publish({
        data: {
          name,
          kind,
          cls,
          description,
          imageUrl,
          price: Number(price) || 0,
          timerHours: cls === "normal" ? null : Number(timerH) || 0,
          timerMinutes: cls === "normal" ? null : Number(timerM) || 0,
          timerSeconds: cls === "normal" ? null : Number(timerS) || 0,
          stock: cls !== "normal" && stock.trim() !== "" ? Number(stock) || 0 : null,
          value: itemValue.trim() !== "" ? Number(itemValue) || 0 : null,
          hidden,
        },
      });
      toast.success("Item published.");
      setName("");
      setDescription("");
      setImageUrl("");
      await reloadItems();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function doDeleteItem(item: AdminItem) {
    if (!window.confirm(`Delete "${item.name}" from the catalog? Owners will lose their copies.`)) return;
    try {
      await deleteItem({ data: { itemId: item.id } });
      toast.success("Item deleted.");
      await reloadItems();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function reloadInventory(userId: string) {
    setInventory((await getInventory({ data: { userId } })) as unknown as InventoryRow[]);
  }

  async function doFind() {
    try {
      const u = (await findUser({ data: { username: search } })) as FoundUser | null;
      setUser(u);
      setInventory([]);
      if (!u) {
        toast.error("User not found.");
        return;
      }
      await reloadInventory(u.id);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function doGiveItem() {
    if (!user || !giveItemId) return;
    try {
      await giveItem({ data: { userId: user.id, itemId: giveItemId } });
      toast.success("Item given.");
      await reloadInventory(user.id);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function doRemoveItem(row: InventoryRow) {
    if (!user) return;
    const label = row.items?.name ?? "this item";
    if (!window.confirm(`Remove ${label}${row.serial !== null ? ` #${row.serial}` : ""} from ${user.username}?`))
      return;
    try {
      await removeUserItem({ data: { userItemId: row.id } });
      toast.success("Item removed.");
      await reloadInventory(user.id);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (authed === null) return null;

  if (!authed) {
    return (
      <AppLayout>
        <div className="rb-card mx-auto max-w-sm p-6">
          <h1 className="rb-heading">Admin Panel</h1>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doLogin()}
            placeholder="Admin password"
            className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={doLogin}
            className="mt-3 w-full rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            Enter
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="rb-card p-5">
        <div className="flex items-center justify-between">
          <h1 className="rb-heading mb-0">Admin Panel</h1>
          <button
            onClick={async () => {
              await logout();
              setAuthed(false);
            }}
            className="text-sm font-semibold text-primary hover:underline"
          >
            Lock panel
          </button>
        </div>
      </div>

      <div className="rb-card mt-4 p-5">
        <h2 className="rb-heading">Publish item</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Item name"
            className="h-9 rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary"
          />
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="Image URL"
            className="h-9 rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary"
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm capitalize"
          >
            {KINDS.map((k) => (
              <option key={k} value={k} className="capitalize">
                {k}
              </option>
            ))}
          </select>
          <select
            value={cls}
            onChange={(e) => setCls(e.target.value as typeof cls)}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm"
          >
            <option value="normal">Normal (on sale)</option>
            <option value="limited">Limited</option>
            <option value="limitedu">Limited U</option>
            <option value="offsale">Offsale (stock/timer, then closed; no resale or trading)</option>
          </select>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price"
            inputMode="numeric"
            className="h-9 rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary"
          />
          <input
            value={itemValue}
            onChange={(e) => setItemValue(e.target.value)}
            placeholder="Value (blank = same as price)"
            inputMode="numeric"
            className="h-9 rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary"
          />
          {cls !== "normal" && (
            <>
            <input
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder={cls === "offsale" ? "Stock (0 + 0 timer = offsale immediately)" : "Stock (leave empty for unlimited)"}
              inputMode="numeric"
              className="h-9 rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary"
            />
            <div className="flex items-center gap-2">
              <input
                value={timerH}
                onChange={(e) => setTimerH(e.target.value)}
                placeholder="Hours"
                inputMode="numeric"
                className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary"
              />
              <input
                value={timerM}
                onChange={(e) => setTimerM(e.target.value)}
                placeholder="Minutes"
                inputMode="numeric"
                className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary"
              />
              <input
                value={timerS}
                onChange={(e) => setTimerS(e.target.value)}
                placeholder="Seconds"
                inputMode="numeric"
                className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary"
              />
            </div>
            </>
          )}
          <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
            <input
              type="checkbox"
              checked={hidden}
              onChange={(e) => setHidden(e.target.checked)}
            />
            Hide from catalog (still visible here in the admin panel)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            rows={3}
            className="rounded-md border border-input bg-card p-3 text-sm outline-none focus:border-primary sm:col-span-2"
          />
        </div>
        <button
          onClick={doPublish}
          className="mt-3 rounded-md bg-buy px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
        >
          Publish
        </button>
      </div>

      <div className="rb-card mt-4 p-5">
        <h2 className="rb-heading">Manage player</h2>
        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Username"
            className="h-9 w-56 rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={doFind}
            className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            Find
          </button>
        </div>

        {user && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-sm">
              <strong>{user.username}</strong> — {user.rawbux.toLocaleString("en-US")} Rawbux
              {user.is_banned ? " — currently banned" : ""}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="h-9 rounded-md border border-input bg-card px-3 text-sm"
              >
                {DURATIONS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ban reason"
                className="h-9 w-64 rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary"
              />
              <button
                onClick={async () => {
                  await ban({ data: { userId: user.id, duration, reason } });
                  toast.success("Player banned.");
                  await doFind();
                }}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground hover:opacity-90"
              >
                Ban
              </button>
              <button
                onClick={async () => {
                  await unban({ data: { userId: user.id } });
                  toast.success("Player unbanned.");
                  await doFind();
                }}
                className="rounded-md border border-border px-4 py-2 text-sm font-bold hover:bg-surface"
              >
                Unban
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="numeric"
                className="h-9 w-32 rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary"
              />
              <button
                onClick={async () => {
                  await grant({ data: { userId: user.id, amount: Number(amount) || 0 } });
                  toast.success("Rawbux granted.");
                  await doFind();
                }}
                className="rounded-md bg-buy px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
              >
                Give Rawbux
              </button>
              <button
                onClick={async () => {
                  if (!window.confirm(`Reset ${user.username}'s Rawbux to 0?`)) return;
                  await resetRawbux({ data: { userId: user.id } });
                  toast.success("Rawbux reset to 0.");
                  await doFind();
                }}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground hover:opacity-90"
              >
                Reset Rawbux
              </button>
              <button
                onClick={async () => {
                  const pw = window.prompt(`New password for ${user.username} (min 6 characters):`);
                  if (!pw) return;
                  try {
                    await resetPassword({ data: { userId: user.id, newPassword: pw } });
                    toast.success("Password reset.");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Failed to reset password.");
                  }
                }}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground hover:opacity-90"
              >
                Reset Password
              </button>
            </div>

            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">
                Inventory ({inventory.length})
              </p>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <select
                  value={giveItemId}
                  onChange={(e) => setGiveItemId(e.target.value)}
                  className="h-9 max-w-64 rounded-md border border-input bg-card px-3 text-sm"
                >
                  <option value="">Pick an item to give...</option>
                  {itemOptions.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={doGiveItem}
                  disabled={!giveItemId}
                  className="rounded-md bg-buy px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  Give item
                </button>
              </div>
              {inventory.length === 0 ? (
                <p className="text-sm text-muted-foreground">This player owns no items.</p>
              ) : (
                <div className="space-y-1">
                  {inventory.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5 text-sm"
                    >
                      <span className="truncate">
                        {row.items?.name ?? "Unknown item"}
                        {row.serial !== null && (
                          <span className="ml-1 text-xs text-muted-foreground">#{row.serial}</span>
                        )}
                        {row.sale_price !== null && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (on sale for {row.sale_price.toLocaleString("en-US")})
                          </span>
                        )}
                      </span>
                      <button
                        onClick={() => doRemoveItem(row)}
                        className="shrink-0 rounded-md border border-border px-2 py-1 text-xs font-bold text-destructive hover:bg-surface"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rb-card mt-4 p-5">
        <h2 className="rb-heading">Promocodes</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Code (e.g. RAWBLOX2021)"
            className="h-9 rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary"
          />
          <input
            value={codeRawbux}
            onChange={(e) => setCodeRawbux(e.target.value)}
            inputMode="numeric"
            placeholder="Rawbux reward"
            className="h-9 rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary"
          />
          <select
            value={codeItem}
            onChange={(e) => setCodeItem(e.target.value)}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm"
          >
            <option value="">No item reward</option>
            {itemOptions.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          <input
            value={codeMax}
            onChange={(e) => setCodeMax(e.target.value)}
            inputMode="numeric"
            placeholder="Max uses (blank = unlimited)"
            className="h-9 rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary"
          />
          <input
            value={codeDays}
            onChange={(e) => setCodeDays(e.target.value)}
            inputMode="numeric"
            placeholder="Expires in days (blank = never)"
            className="h-9 rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <button
          onClick={doCreateCode}
          className="mt-3 rounded-md bg-buy px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
        >
          Create promocode
        </button>

        {codes.length > 0 && (
          <ul className="mt-4 divide-y divide-border border-t border-border">
            {codes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="font-bold">{c.code}</span>
                <span className="text-muted-foreground">
                  {c.rawbux_reward} Rawbux · {c.uses}
                  {c.max_uses ? `/${c.max_uses}` : ""} uses
                  {c.expires_at ? ` · expires ${new Date(c.expires_at).toLocaleDateString()}` : ""}
                  {c.is_active ? "" : " · disabled"}
                </span>
                <button
                  onClick={async () => {
                    await setCodeActive({ data: { id: c.id, active: !c.is_active } });
                    await reloadCodes();
                  }}
                  className="ml-auto rounded-md border border-border px-3 py-1 text-xs font-bold hover:bg-surface"
                >
                  {c.is_active ? "Disable" : "Enable"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rb-card mt-4 p-5">
        <h2 className="rb-heading">Catalog items</h2>
        {itemOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items published yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {itemOptions.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="font-bold">{i.name}</span>
                <span className="capitalize text-muted-foreground">
                  {i.kind} · {i.class === "limitedu" ? "Limited U" : i.class === "offsale" ? "Offsale" : i.class} · {i.price.toLocaleString("en-US")} Rawbux
                  {i.class !== "normal" ? ` · ${i.copies_sold} sold` : ""}
                </span>
                {i.hidden && (
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
                    Hidden
                  </span>
                )}
                <HideToggle item={i} onSaved={reloadItems} />
                <EditEditor item={i} onSaved={reloadItems} />
                {BODY_KINDS.includes(i.kind) ? <BodyPartEditor item={i} /> : <AccessoryEditor item={i} />}
                {i.kind === "face" && <FaceEditor item={i} />}
                <ValueEditor item={i} onSaved={reloadItems} />
                {i.class !== "normal" && <RestockEditor item={i} onSaved={reloadItems} />}
                <button
                  onClick={() => doDeleteItem(i)}
                  className="rounded-md bg-destructive px-3 py-1 text-xs font-bold text-destructive-foreground hover:opacity-90"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  );
}

function HideToggle({ item, onSaved }: { item: AdminItem; onSaved: () => void | Promise<void> }) {
  const setItemHidden = useServerFn(adminSetItemHidden);
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await setItemHidden({ data: { itemId: item.id, hidden: !item.hidden } });
          toast.success(item.hidden ? "Item is visible in the catalog." : "Item hidden from the catalog.");
          await onSaved();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Failed to update item.");
        } finally {
          setBusy(false);
        }
      }}
      className="rounded-md border border-border px-3 py-1 text-xs font-bold hover:bg-surface disabled:opacity-50"
    >
      {item.hidden ? "Show in catalog" : "Hide from catalog"}
    </button>
  );
}

function EditEditor({ item, onSaved }: { item: AdminItem; onSaved: () => void | Promise<void> }) {
  const editItem = useServerFn(adminEditItem);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(item.name);
  const [desc, setDesc] = useState(item.description ?? "");
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-border px-3 py-1 text-xs font-bold hover:bg-surface"
      >
        Edit
      </button>
    );
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-2 rounded-md border border-border p-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        className="h-7 w-48 rounded-md border border-input bg-card px-2 text-sm outline-none focus:border-primary"
      />
      <input
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Description"
        className="h-7 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-sm outline-none focus:border-primary"
      />
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await editItem({ data: { itemId: item.id, name, description: desc } });
            toast.success("Item updated.");
            setOpen(false);
            await onSaved();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to update item.");
          } finally {
            setBusy(false);
          }
        }}
        className="rounded-md bg-primary px-3 py-1 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        Save
      </button>
      <button
        onClick={() => setOpen(false)}
        className="rounded-md border border-border px-3 py-1 text-xs font-bold hover:bg-surface"
      >
        Cancel
      </button>
    </div>
  );
}

function RestockEditor({ item, onSaved }: { item: AdminItem; onSaved: () => void | Promise<void> }) {
  const restock = useServerFn(adminRestockItem);
  const [open, setOpen] = useState(false);
  const [stock, setStock] = useState("");
  const [h, setH] = useState("0");
  const [m, setM] = useState("0");
  const [sec, setSec] = useState("0");
  const [busy, setBusy] = useState(false);

  const isLimited =
    (item.stock !== null && item.stock <= 0) ||
    (!!item.sale_ends_at && new Date(item.sale_ends_at).getTime() <= Date.now());

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-border px-3 py-1 text-xs font-bold hover:bg-surface"
      >
        {isLimited ? "Restock" : "Restock / retimer"}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
      <label className="text-xs font-semibold text-muted-foreground">Stock</label>
      <input
        value={stock}
        onChange={(e) => setStock(e.target.value)}
        placeholder="none"
        className="h-7 w-20 rounded-md border border-input bg-card px-2 text-sm outline-none focus:border-primary"
      />
      <label className="text-xs font-semibold text-muted-foreground">Timer</label>
      {[
        [h, setH, "h"],
        [m, setM, "m"],
        [sec, setSec, "s"],
      ].map(([v, set, label]) => (
        <span key={label as string} className="flex items-center gap-1">
          <input
            value={v as string}
            onChange={(e) => (set as (x: string) => void)(e.target.value)}
            className="h-7 w-14 rounded-md border border-input bg-card px-2 text-sm outline-none focus:border-primary"
          />
          <span className="text-xs text-muted-foreground">{label as string}</span>
        </span>
      ))}
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await restock({
              data: {
                itemId: item.id,
                stock: stock.trim() === "" ? null : Number(stock) || 0,
                hours: Number(h) || 0,
                minutes: Number(m) || 0,
                seconds: Number(sec) || 0,
              },
            });
            toast.success(`${item.name} is on sale again.`);
            setOpen(false);
            await onSaved();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to restock item");
          } finally {
            setBusy(false);
          }
        }}
        className="rounded-md bg-buy px-3 py-1 text-xs font-bold text-buy-foreground disabled:opacity-50"
      >
        Save
      </button>
      <button
        onClick={() => setOpen(false)}
        className="rounded-md border border-border px-3 py-1 text-xs font-bold hover:bg-surface"
      >
        Cancel
      </button>
    </div>
  );
}

function ValueEditor({ item, onSaved }: { item: AdminItem; onSaved: () => void | Promise<void> }) {
  const setRap = useServerFn(adminSetItemRap);
  const setValue = useServerFn(adminSetItemValue);
  const [rap, setRapValue] = useState(String(item.rap ?? 0));
  const [value, setValueState] = useState(String(item.value ?? 0));
  const [busy, setBusy] = useState(false);

  return (
    <div className="ml-auto flex flex-wrap items-center gap-2">
      <label className="text-xs font-semibold text-muted-foreground">RAP</label>
      <input
        value={rap}
        onChange={(e) => setRapValue(e.target.value)}
        className="h-7 w-24 rounded-md border border-input bg-card px-2 text-sm outline-none focus:border-primary"
      />
      <label className="text-xs font-semibold text-muted-foreground">Value</label>
      <input
        value={value}
        onChange={(e) => setValueState(e.target.value)}
        className="h-7 w-24 rounded-md border border-input bg-card px-2 text-sm outline-none focus:border-primary"
      />
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await setRap({ data: { itemId: item.id, rap: Number(rap) || 0 } });
            await setValue({ data: { itemId: item.id, value: Number(value) || 0 } });
            toast.success("RAP and value updated");
            await onSaved();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to update item");
          } finally {
            setBusy(false);
          }
        }}
        className="rounded-md border border-border px-3 py-1 text-xs font-bold hover:bg-surface disabled:opacity-50"
      >
        Save
      </button>
    </div>
  );
}

function AccessoryEditor({ item }: { item: AdminItem }) {
  const setAcc = useServerFn(adminSetAccessory);
  const removeAcc = useServerFn(adminRemoveAccessory);
  const [open, setOpen] = useState(false);
  const [rbxm, setRbxm] = useState<File | null>(null);
  const [mesh, setMesh] = useState<File | null>(null);
  const [tex, setTex] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="rounded-md border border-border px-3 py-1 text-xs font-bold hover:bg-surface">
        3D model
      </button>
    );
  const upload = async () => {
    if (!rbxm) {
      toast.error("Choose a .rbxm file first.");
      return;
    }
    setBusy(true);
    try {
      const { parseRbxm } = await import("@/lib/rbxm");
      const { parseRobloxMesh, bytesToBase64 } = await import("@/lib/robloxMesh");
const { normalizeMeshBytes } = await import("@/lib/robloxMeshV7");
const meta = parseRbxm(await rbxm.arrayBuffer());

let meshB64: string | null = null;
if (mesh) {
  const bytes = await normalizeMeshBytes(new Uint8Array(await mesh.arrayBuffer()));
  parseRobloxMesh(bytes);
  meshB64 = bytesToBase64(bytes);
}
      let textureDataUrl: string | null = null;
      if (tex)
        textureDataUrl = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result as string);
          r.onerror = rej;
          r.readAsDataURL(tex);
        });
      const out = await setAcc({ data: { itemId: item.id, meta: meta as never, meshB64, textureDataUrl } });
      toast.success(out.hasTexture ? "3D accessory attached." : "3D accessory attached (no texture).");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };
  const field = "text-xs file:mr-2 file:rounded file:border file:border-border file:bg-card file:px-2 file:py-0.5";
  return (
    <div className="flex w-full flex-col gap-2 rounded-md border border-border p-2 text-xs">
      <label>Accessory (.rbxm / .rbxmx) <input type="file" accept=".rbxm,.rbxmx" className={field} onChange={(e) => setRbxm(e.target.files?.[0] ?? null)} /></label>
      <label>Mesh (.mesh, optional) <input type="file" accept=".mesh" className={field} onChange={(e) => setMesh(e.target.files?.[0] ?? null)} /></label>
      <label>Texture (image, optional) <input type="file" accept="image/*" className={field} onChange={(e) => setTex(e.target.files?.[0] ?? null)} /></label>
      <div className="flex gap-2">
        <button disabled={busy} onClick={upload} className="rounded-md bg-primary px-3 py-1 font-bold text-primary-foreground disabled:opacity-50">{busy ? "Uploading..." : "Upload"}</button>
        <button
          onClick={async () => {
            await removeAcc({ data: { itemId: item.id } });
            toast.success("3D model removed.");
          }}
          className="rounded-md border border-border px-3 py-1 font-bold"
        >
          Remove 3D
        </button>
        <button onClick={() => setOpen(false)} className="rounded-md border border-border px-3 py-1 font-bold">Cancel</button>
      </div>
    </div>
  );
}
function BodyPartEditor({ item }: { item: AdminItem }) {
  const setBody = useServerFn(adminSetBodyPart);
  const removeAcc = useServerFn(adminRemoveAccessory);
  const [open, setOpen] = useState(false);
  const [mesh, setMesh] = useState<File | null>(null);
  const [tex, setTex] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="rounded-md border border-border px-3 py-1 text-xs font-bold hover:bg-surface">
        Body mesh
      </button>
    );
  const upload = async () => {
    if (!mesh) return toast.error("Choose a .mesh file first.");
    setBusy(true);
    try {
      const { parseRobloxMesh, bytesToBase64 } = await import("@/lib/robloxMesh");
const { normalizeMeshBytes } = await import("@/lib/robloxMeshV7");
const bytes = await normalizeMeshBytes(new Uint8Array(await mesh.arrayBuffer()));
try {
  parseRobloxMesh(bytes);
} catch {
  throw new Error("That file isn't a readable Roblox .mesh file.");
}
      let textureDataUrl: string | null = null;
      if (tex)
        textureDataUrl = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result as string);
          r.onerror = rej;
          r.readAsDataURL(tex);
        });
      await setBody({ data: { itemId: item.id, meshB64: bytesToBase64(bytes), textureDataUrl } });
      toast.success("Body part mesh attached.");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
    return;
  };
  const field = "text-xs file:mr-2 file:rounded file:border file:border-border file:bg-card file:px-2 file:py-0.5";
  return (
    <div className="flex w-full flex-col gap-2 rounded-md border border-border p-2 text-xs">
      <label>Body part ({item.kind}) mesh (.mesh) <input type="file" accept=".mesh" className={field} onChange={(e) => setMesh(e.target.files?.[0] ?? null)} /></label>
      <label>Texture (image, optional — otherwise uses skin colour) <input type="file" accept="image/*" className={field} onChange={(e) => setTex(e.target.files?.[0] ?? null)} /></label>
      <div className="flex gap-2">
        <button disabled={busy} onClick={upload} className="rounded-md bg-primary px-3 py-1 font-bold text-primary-foreground disabled:opacity-50">{busy ? "Uploading..." : "Upload"}</button>
        <button
          onClick={async () => {
            await removeAcc({ data: { itemId: item.id } });
            toast.success("Body mesh removed.");
          }}
          className="rounded-md border border-border px-3 py-1 font-bold"
        >
          Remove mesh
        </button>
        <button onClick={() => setOpen(false)} className="rounded-md border border-border px-3 py-1 font-bold">Cancel</button>
      </div>
    </div>
  );
}

function FaceEditor({ item }: { item: AdminItem }) {
  const setFace = useServerFn(adminSetFace);
  const removeAcc = useServerFn(adminRemoveAccessory);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-border px-3 py-1 text-xs font-bold hover:bg-surface"
      >
        Face image
      </button>
    );

  const upload = async () => {
    if (!file) {
      toast.error("Choose a PNG file first.");
      return;
    }
    if (file.type !== "image/png") {
      toast.error("Only PNG images are supported.");
      return;
    }
    if (file.size > 1024 * 1024) {
      toast.error("The image must be under 1 MB.");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      await setFace({ data: { itemId: item.id, imageDataUrl: dataUrl } });
      toast.success("Face image attached.");
      setFile(null);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-2 rounded-md border border-border p-2 text-xs">
      <label>
        Face image (PNG, same style as the default face){" "}
        <input
          type="file"
          accept="image/png"
          className="text-xs file:mr-2 file:rounded file:border file:border-border file:bg-card file:px-2 file:py-0.5"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <div className="flex gap-2">
        <button
          disabled={busy}
          onClick={upload}
          className="rounded-md bg-primary px-3 py-1 font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Uploading..." : "Upload"}
        </button>
        <button
          onClick={async () => {
            await removeAcc({ data: { itemId: item.id } });
            toast.success("Face image removed.");
          }}
          className="rounded-md border border-border px-3 py-1 font-bold"
        >
          Remove image
        </button>
        <button onClick={() => setOpen(false)} className="rounded-md border border-border px-3 py-1 font-bold">
          Cancel
        </button>
      </div>
    </div>
  );
}
