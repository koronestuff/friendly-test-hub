import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { rpcMessage } from "@/lib/social";

export const Route = createFileRoute("/promocodes")({
  head: () => ({
    meta: [
      { title: "Promocodes — Rawblox" },
      { name: "description", content: "Redeem Rawblox promocodes for free items and Rawbux." },
      { property: "og:title", content: "Promocodes — Rawblox" },
      {
        property: "og:description",
        content: "Redeem Rawblox promocodes for free items and Rawbux.",
      },
    ],
  }),
  component: PromocodesPage,
});

function PromocodesPage() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const { refresh } = useAuth();

  async function redeem() {
    if (!code.trim()) return;
    setBusy(true);
    const msg = await rpcMessage(await supabase.rpc("redeem_promocode", { _code: code.trim() }));
    setBusy(false);
    if (msg !== "ok") {
      toast.error(msg);
      return;
    }
    toast.success("Promocode redeemed!");
    setCode("");
    await refresh();
  }

  return (
    <AppLayout>
      <div className="rb-card p-5">
        <h1 className="rb-heading">Promocodes</h1>
        <p className="mb-3 text-sm text-muted-foreground">
          Enter a promocode below to redeem free rewards.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && redeem()}
            placeholder="Enter your code"
            className="h-9 w-64 rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={redeem}
            disabled={busy}
            className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Redeem
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
