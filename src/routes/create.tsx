import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { ItemCard } from "@/components/ItemCard";
import { useAuth } from "@/lib/auth";
import type { Item } from "@/lib/format";
import {
  CLOTHING_KINDS,
  CLOTHING_LABEL,
  TEMPLATE_H,
  TEMPLATE_W,
  loadHeadAndFace,
  loadImage,
  renderClothingThumb,
  type ClothingKind,
} from "@/lib/clothing";

export const Route = createFileRoute("/create")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Create — Rawrion Economy Simulator" },
      { name: "description", content: "Upload classic shirts, pants and t-shirts and sell them in the catalog." },
      { property: "og:title", content: "Create — Rawrion Economy Simulator" },
      { property: "og:description", content: "Upload classic shirts, pants and t-shirts and sell them in the catalog." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CreatePage,
});

function readDataUrl(file: File) {
  return new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

function CreatePage() {
  const { session, refresh } = useAuth();
  const uid = session?.user.id;
  const qc = useQueryClient();
  const [kind, setKind] = useState<ClothingKind>("shirt");
  const [template, setTemplate] = useState<string | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("10");
  const [busy, setBusy] = useState(false);

  const { data: mine } = useQuery({
    queryKey: ["my-creations", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase
        .from("items")
        .select("*")
        .eq("creator_id", uid!)
        .order("created_at", { ascending: false });
      return (data ?? []) as Item[];
    },
  });

  async function makeThumb(dataUrl: string, k: ClothingKind) {
    const img = await loadImage(dataUrl);
    const { geo, faceImg } = await loadHeadAndFace();
    setThumb(await renderClothingThumb({ kind: k, img }, geo, faceImg));
  }

  async function onFile(file: File | undefined) {
    setTemplate(null);
    setThumb(null);
    if (!file) return;
    if (file.type !== "image/png" || !file.name.toLowerCase().endsWith(".png")) {
      toast.error("Only PNG images are supported.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("The image must be under 2 MB.");
      return;
    }
    const url = await readDataUrl(file);
    const img = await loadImage(url);
    if (img.naturalWidth !== TEMPLATE_W || img.naturalHeight !== TEMPLATE_H) {
      toast.error(`The image must be exactly ${TEMPLATE_W} x ${TEMPLATE_H} pixels (yours is ${img.naturalWidth} x ${img.naturalHeight}).`);
      return;
    }
    setTemplate(url);
    if (!name) setName(file.name.replace(/\.png$/i, "").slice(0, 50));
    await makeThumb(url, kind);
  }

  async function changeKind(k: ClothingKind) {
    setKind(k);
    if (template) await makeThumb(template, k);
  }

  async function publish() {
    if (!template || !thumb) return toast.error("Upload a template first.");
    const p = Number(price);
    if (!Number.isInteger(p) || p < 0) return toast.error("Enter a valid price.");
    setBusy(true);
    const { data, error } = await supabase.rpc("publish_clothing", {
      _name: name,
      _kind: kind,
      _description: description,
      _price: p,
      _template: template,
      _thumb: thumb,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (data !== "ok") return toast.error(String(data));
    toast.success("Your clothing is now on sale in the catalog!");
    setTemplate(null);
    setThumb(null);
    setName("");
    setDescription("");
    await refresh();
    await qc.invalidateQueries({ queryKey: ["my-creations", uid] });
    return;
  }

  if (!uid) {
    return (
      <AppLayout>
        <div className="rb-card p-8 text-center text-sm">
          <Link to="/auth" className="text-primary underline">Sign in</Link> to create clothing.
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="rb-card p-4">
        <h1 className="rb-heading">Create Clothing</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Upload a classic clothing template. Only PNG images sized exactly {TEMPLATE_W} x {TEMPLATE_H} pixels are accepted.
        </p>
        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
          <div className="flex aspect-square items-center justify-center rounded-md border border-border bg-surface">
            {thumb ? (
              <img src={thumb} alt="Preview" className="h-full w-full object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">Preview appears here</span>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {CLOTHING_KINDS.map((k) => (
                <button
                  key={k}
                  onClick={() => changeKind(k)}
                  className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${
                    kind === k ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent"
                  }`}
                >
                  {CLOTHING_LABEL[k]}
                </button>
              ))}
            </div>
            <input
              type="file"
              accept="image/png"
              onChange={(e) => onFile(e.target.files?.[0])}
              className="block w-full text-sm"
            />
            <label className="block text-sm font-semibold">
              Name
              <input value={name} maxLength={50} onChange={(e) => setName(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-card px-2 font-normal outline-none" />
            </label>
            <label className="block text-sm font-semibold">
              Description
              <textarea value={description} maxLength={1000} onChange={(e) => setDescription(e.target.value)}
                className="mt-1 h-20 w-full rounded-md border border-input bg-card p-2 font-normal outline-none" />
            </label>
            <label className="block text-sm font-semibold">
              Price (Rawribux)
              <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)}
                className="mt-1 h-9 w-40 rounded-md border border-input bg-card px-2 font-normal outline-none" />
            </label>
            <button onClick={publish} disabled={busy || !thumb}
              className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {busy ? "Publishing..." : "Publish"}
            </button>
          </div>
        </div>
      </div>

      <div className="rb-card mt-4 p-4">
        <h2 className="rb-heading">My Creations</h2>
        {mine && mine.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {mine.map((i) => <ItemCard key={i.id} item={i} />)}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">You haven't published any clothing yet.</p>
        )}
      </div>
    </AppLayout>
  );
}
