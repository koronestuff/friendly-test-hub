import { createServerFn } from "@tanstack/react-start";

export const adminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { isAdmin } = await import("./admin.server");
  return { admin: await isAdmin() };
});

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const { passwordMatches, getAdminSession } = await import("./admin.server");
    const expected = process.env["ADMIN_PANEL_PASSWORD"];
    if (!expected) throw new Error("Admin password is not configured");
    if (!passwordMatches(data.password, expected)) return { ok: false as const };
    const session = await getAdminSession();
    await session.update({ admin: true });
    return { ok: true as const };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { getAdminSession } = await import("./admin.server");
  const session = await getAdminSession();
  await session.clear();
  return { ok: true as const };
});

export const publishItem = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      name: string;
      kind: string;
      cls: "normal" | "limited" | "limitedu" | "offsale";
      description: string;
      imageUrl: string;
      price: number;
      timerHours: number | null;
      timerMinutes?: number | null;
      timerSeconds?: number | null;
      stock?: number | null;
      value?: number | null;
      hidden?: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const totalSeconds =
      (data.timerHours ?? 0) * 3600 +
      (data.timerMinutes ?? 0) * 60 +
      (data.timerSeconds ?? 0);
    // Offsale with no stock and no timer = offsale immediately
    const instantOffsale =
      data.cls === "offsale" && !(totalSeconds > 0) && !((data.stock ?? 0) > 0);
    const saleEnds =
      data.cls !== "normal" && totalSeconds > 0
        ? new Date(Date.now() + totalSeconds * 1000).toISOString()
        : null;
    const { error } = await supabaseAdmin.from("items").insert({
      name: data.name.trim(),
      kind: data.kind as never,
      class: data.cls,
      description: data.description,
      image_url: data.imageUrl || null,
      price: Math.max(0, Math.round(data.price)),
      sale_ends_at: saleEnds,
      stock: instantOffsale
        ? 0
        : data.stock === null || data.stock === undefined
          ? null
          : Math.max(0, Math.round(data.stock)),
      hidden: !!data.hidden,
      rap: Math.max(0, Math.round(data.price)),
      value: Math.max(
        0,
        Math.round(data.value === null || data.value === undefined ? data.price : data.value),
      ),
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminFindUser = createServerFn({ method: "POST" })
  .inputValidator((data: { username: string }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("profiles")
      .select("id, username, rawbux, is_banned, ban_reason, ban_until")
      .ilike("username", data.username.trim())
      .limit(1);
    return rows?.[0] ?? null;
  });

export const adminBanUser = createServerFn({ method: "POST" })
  .inputValidator((data: { userId: string; duration: string; reason: string }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin, banUntil } = await import("./admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        is_banned: true,
        ban_reason: data.reason,
        ban_until: banUntil(data.duration),
      })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminUnbanUser = createServerFn({ method: "POST" })
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_banned: false, ban_reason: null, ban_until: null })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminGrantRawbux = createServerFn({ method: "POST" })
  .inputValidator((data: { userId: string; amount: number }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("profiles")
      .select("rawbux")
      .eq("id", data.userId)
      .maybeSingle();
    if (!row) throw new Error("User not found");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ rawbux: Math.max(0, row.rawbux + Math.round(data.amount)) })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminResetRawbux = createServerFn({ method: "POST" })
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ rawbux: 0 })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .inputValidator((data: { userId: string; newPassword: string }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin();
    if (!data.newPassword || data.newPassword.length < 6)
      throw new Error("Password must be at least 6 characters.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminListPromocodes = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("promocodes")
    .select("id, code, rawbux_reward, item_id, max_uses, uses, expires_at, is_active")
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
});

export const adminCreatePromocode = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      code: string;
      rawbux: number;
      itemId: string | null;
      maxUses: number | null;
      expiresInDays: number | null;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("promocodes").insert({
      code: data.code.trim(),
      rawbux_reward: Math.max(0, Math.round(data.rawbux)),
      item_id: data.itemId || null,
      max_uses: data.maxUses ?? null,
      expires_at: data.expiresInDays
        ? new Date(Date.now() + data.expiresInDays * 86400000).toISOString()
        : null,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminSetPromocodeActive = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; active: boolean }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("promocodes")
      .update({ is_active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminListItems = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("items")
    .select("id, name, kind, class, price, copies_sold, rap, value, stock, sale_ends_at, description, hidden")
    .order("created_at", { ascending: false })
    .limit(200);
  return data ?? [];
});

export const adminSetItemHidden = createServerFn({ method: "POST" })
  .inputValidator((data: { itemId: string; hidden: boolean }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("items")
      .update({ hidden: data.hidden })
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminSetItemRap = createServerFn({ method: "POST" })
  .inputValidator((data: { itemId: string; rap: number }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("items")
      .update({ rap: Math.max(0, Math.round(data.rap)) })
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminSetItemValue = createServerFn({ method: "POST" })
  .inputValidator((data: { itemId: string; value: number }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("items")
      .update({ value: Math.max(0, Math.round(data.value)) })
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminRestockItem = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { itemId: string; stock: number | null; hours: number; minutes: number; seconds: number }) =>
      data,
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const totalSeconds =
      Math.max(0, Math.floor(data.hours)) * 3600 +
      Math.max(0, Math.floor(data.minutes)) * 60 +
      Math.max(0, Math.floor(data.seconds));
    const stock =
      data.stock === null || Number.isNaN(data.stock) ? null : Math.max(0, Math.round(data.stock));
    if (totalSeconds <= 0 && (stock === null || stock <= 0)) {
      throw new Error("Set a stock amount above 0 or a timer above 0.");
    }
    const { error } = await supabaseAdmin
      .from("items")
      .update({
        stock,
        sale_ends_at:
          totalSeconds > 0 ? new Date(Date.now() + totalSeconds * 1000).toISOString() : null,
      })
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminEditItem = createServerFn({ method: "POST" })
  .inputValidator((data: { itemId: string; name: string; description: string }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin();
    const name = data.name.trim();
    if (!name) throw new Error("Name cannot be empty.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("items")
      .update({ name, description: data.description })
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminGetInventory = createServerFn({ method: "POST" })
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("user_items")
      .select("id, serial, sale_price, items(id, name, kind, class)")
      .eq("user_id", data.userId)
      .order("acquired_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminRemoveUserItem = createServerFn({ method: "POST" })
  .inputValidator((data: { userItemId: string }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: e1 } = await supabaseAdmin
      .from("trade_items")
      .delete()
      .eq("user_item_id", data.userItemId);
    if (e1) throw new Error(e1.message);
    const { error } = await supabaseAdmin
      .from("user_items")
      .delete()
      .eq("id", data.userItemId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminGiveItem = createServerFn({ method: "POST" })
  .inputValidator((data: { userId: string; itemId: string }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: item } = await supabaseAdmin
      .from("items")
      .select("id, class")
      .eq("id", data.itemId)
      .maybeSingle();
    if (!item) throw new Error("Item not found");
    let serial: number | null = null;
    if (item.class !== "normal" && item.class !== "offsale") {
      const { data: rows } = await supabaseAdmin
        .from("user_items")
        .select("serial")
        .eq("item_id", data.itemId)
        .order("serial", { ascending: false })
        .limit(1);
      serial = ((rows?.[0]?.serial as number | null) ?? 0) + 1;
    }
    const { error } = await supabaseAdmin.from("user_items").insert({
      item_id: data.itemId,
      user_id: data.userId,
      serial,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminDeleteItem = createServerFn({ method: "POST" })
  .inputValidator((data: { itemId: string }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Remove everything that references the item first.
    const { error: e1 } = await supabaseAdmin
      .from("trade_items")
      .delete()
      .eq("item_id", data.itemId);
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await supabaseAdmin
      .from("user_items")
      .delete()
      .eq("item_id", data.itemId);
    if (e2) throw new Error(e2.message);
    const { error: e3 } = await supabaseAdmin
      .from("promocodes")
      .update({ item_id: null })
      .eq("item_id", data.itemId);
    if (e3) throw new Error(e3.message);
    const { error } = await supabaseAdmin.from("items").delete().eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminSetAccessory = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      itemId: string;
      meta: Record<string, unknown>;
      meshB64?: string | null;
      textureDataUrl?: string | null;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin();
    const fetchAsset = async (id: unknown) => {
      if (typeof id !== "string" || !/^\d+$/.test(id)) return null;
      try {
        const res = await fetch(`https://assetdelivery.roblox.com/v1/asset/?id=${id}`);
        if (!res.ok) return null;
        return { bytes: Buffer.from(await res.arrayBuffer()), type: res.headers.get("content-type") ?? "" };
      } catch {
        return null;
      }
    };
    let mesh = data.meshB64 ?? null;
    if (!mesh) {
      const a = await fetchAsset(data.meta['meshId']);
      if (a && a.bytes.subarray(0, 8).toString() === "version ") mesh = a.bytes.toString("base64");
    }
    if (!mesh)
      throw new Error(
        "Roblox blocked the mesh download. Please also attach the accessory's .mesh file.",
      );
    let texture = data.textureDataUrl ?? null;
    if (!texture) {
      const t = await fetchAsset(data.meta['textureId']);
      if (t && t.type.startsWith("image/"))
        texture = `data:${t.type};base64,${t.bytes.toString("base64")}`;
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("item_accessories").upsert({
      item_id: data.itemId,
      meta: data.meta as never,
      mesh_b64: mesh,
      texture_data_url: texture,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true as const, hasTexture: !!texture };
  });

export const adminRemoveAccessory = createServerFn({ method: "POST" })
  .inputValidator((data: { itemId: string }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("item_accessories").delete().eq("item_id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
export const adminSetBodyPart = createServerFn({ method: "POST" })
  .inputValidator((data: { itemId: string; meshB64: string; textureDataUrl?: string | null }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin();
    if (!data.meshB64) throw new Error("Attach a .mesh file.");
    if (data.meshB64.length > 8_000_000) throw new Error("Mesh file is too large.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: item } = await supabaseAdmin
      .from("items")
      .select("id, kind")
      .eq("id", data.itemId)
      .maybeSingle();
    if (!item) throw new Error("Item not found");
    if (!["head", "torso", "arm", "leg"].includes(item.kind))
      throw new Error("Only head, torso, arm or leg items can have a body part mesh.");
    const { error } = await supabaseAdmin.from("item_accessories").upsert({
      item_id: data.itemId,
      meta: { bodyPart: true } as never,
      mesh_b64: data.meshB64,
      texture_data_url: data.textureDataUrl ?? null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminSetFace = createServerFn({ method: "POST" })
  .inputValidator((data: { itemId: string; imageDataUrl: string }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin();
    if (!data.imageDataUrl.startsWith("data:image/png;base64,"))
      throw new Error("Face must be a PNG image.");
    if (data.imageDataUrl.length > 1_500_000)
      throw new Error("Face image is too large (max about 1 MB).");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: item } = await supabaseAdmin
      .from("items")
      .select("id, kind")
      .eq("id", data.itemId)
      .maybeSingle();
    if (!item) throw new Error("Item not found");
    if (item.kind !== "face") throw new Error("Only items of kind 'face' can have a face image.");
    const { error } = await supabaseAdmin.from("item_accessories").upsert({
      item_id: data.itemId,
      meta: { decalFace: true } as never,
      mesh_b64: "",
      texture_data_url: data.imageDataUrl,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
