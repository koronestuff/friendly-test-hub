import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { AvatarViewer } from "@/components/AvatarViewer";
import { ItemCard } from "@/components/ItemCard";
import { useAuth } from "@/lib/auth";
import { rpcMessage } from "@/lib/social";
import type { Item } from "@/lib/format";
import type { AvatarColors } from "@/components/Avatar3D";

export const Route = createFileRoute("/users/$username")({
  head: () => ({
    meta: [
      { title: "User Profile — Rawblox" },
      { name: "description", content: "View a Rawblox player's profile and their collection." },
      { property: "og:title", content: "User Profile — Rawblox" },
      {
        property: "og:description",
        content: "View a Rawblox player's profile and their collection.",
      },
    ],
  }),
  component: UserPage,
});

function UserPage() {
  const { username } = Route.useParams();
  const { profile: me } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["user", username],
    queryFn: async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .ilike("username", username)
        .maybeSingle();
      if (!p) return null;
      const banned = p.is_banned && (!p.ban_until || new Date(p.ban_until) > new Date());
      if (banned) return null;
      const { data: owned } = await supabase.from("user_items").select("item_id").eq("user_id", p.id);
      const ids = [...new Set((owned ?? []).map((o) => o.item_id))];
      const { data: its } = ids.length
        ? await supabase.from("items").select("*").in("id", ids)
        : { data: [] };
      return { profile: p, items: (its ?? []) as Item[] };
    },
  });

  const other = data?.profile.id;
  const qc = useQueryClient();
  const { data: rel } = useQuery({
    enabled: !!other && !!me && other !== me.id,
    queryKey: ["relationship", me?.id, other],
    queryFn: async () => {
      const [fs, req, fol] = await Promise.all([
        supabase
          .from("friendships")
          .select("id")
          .eq("user_a", me!.id < other! ? me!.id : other!)
          .eq("user_b", me!.id < other! ? other! : me!.id)
          .maybeSingle(),
        supabase
          .from("friend_requests")
          .select("id")
          .eq("sender_id", me!.id)
          .eq("receiver_id", other!)
          .eq("status", "pending")
          .maybeSingle(),
        supabase
          .from("follows")
          .select("id")
          .eq("follower_id", me!.id)
          .eq("following_id", other!)
          .maybeSingle(),
      ]);
      return { friends: !!fs.data, requested: !!req.data, following: !!fol.data };
    },
  });

  const refreshRel = () => qc.invalidateQueries({ queryKey: ["relationship"] });

  // Avatar data for the viewer: saved colours, equipped items, and which items the player still owns
  const avatarData = useMemo(() => {
    const p = data?.profile as unknown as
      | { avatar_colors?: Partial<AvatarColors> | null; equipped_items?: string[] | null }
      | undefined;
    return {
      colors: p?.avatar_colors ?? null,
      equipped: p?.equipped_items ?? [],
      ownedIds: (data?.items ?? []).map((i) => i.id),
    };
  }, [data]);

  async function addFriend() {
    const msg = await rpcMessage(await supabase.rpc("send_friend_request", { _target: other! }));
    if (msg !== "ok") toast.error(msg);
    else toast.success("Friend request sent.");
    refreshRel();
  }

  async function removeFriend() {
    const msg = await rpcMessage(await supabase.rpc("remove_friend", { _other: other! }));
    if (msg !== "ok") toast.error(msg);
    else toast.success("Friend removed.");
    refreshRel();
  }

  async function toggleFollow() {
    const msg = await rpcMessage(
      await supabase.rpc("set_follow", { _target: other!, _follow: !rel?.following }),
    );
    if (msg !== "ok") toast.error(msg);
    refreshRel();
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="rb-card p-8 text-center text-sm text-muted-foreground">Loading...</div>
      </AppLayout>
    );
  }

  if (!data) {
    return (
      <AppLayout>
        <div className="rb-card p-10 text-center">
          <h1 className="text-lg font-semibold">Page cannot be found or no longer exists</h1>
        </div>
      </AppLayout>
    );
  }

  const isMe = me?.id === data.profile.id;

  return (
    <AppLayout>
      <div className="rb-card p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="h-[320px] w-[260px] max-w-full shrink-0 overflow-hidden rounded-md border border-border bg-muted">
            <AvatarViewer
              colors={avatarData.colors}
              equipped={avatarData.equipped}
              ownedIds={avatarData.ownedIds}
            />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{data.profile.username}</h1>
            <p className="text-sm text-muted-foreground">
              Joined {new Date(data.profile.created_at).toLocaleDateString()}
            </p>
          </div>
          {!isMe && (
            <div className="flex flex-wrap gap-2">
              {rel?.friends ? (
                <button
                  onClick={removeFriend}
                  className="rounded-md border border-border px-4 py-2 text-sm font-bold hover:bg-surface"
                >
                  Unfriend
                </button>
              ) : (
                <button
                  onClick={addFriend}
                  disabled={rel?.requested}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {rel?.requested ? "Request Sent" : "Add Friend"}
                </button>
              )}
              <button
                onClick={toggleFollow}
                className="rounded-md border border-border px-4 py-2 text-sm font-bold hover:bg-surface"
              >
                {rel?.following ? "Unfollow" : "Follow"}
              </button>
              <Link
                to="/trade/new/$username"
                params={{ username: data.profile.username }}
                className="rounded-md border border-border px-4 py-2 text-sm font-bold hover:bg-surface"
              >
                Trade Items
              </Link>
            </div>
          )}
        </div>
        <div className="mt-5">
          <h2 className="rb-heading">About</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {data.profile.description || "This user hasn't written a description."}
          </p>
        </div>
      </div>

      <div className="rb-card mt-4 p-4">
        <h2 className="rb-heading">Inventory</h2>
        {!isMe && (data.profile as { inventory_private?: boolean }).inventory_private ? (
          <p className="text-sm text-muted-foreground">This user's inventory is private.</p>
        ) : data.items.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {data.items.map((i) => (
              <ItemCard key={i.id} item={i} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">This user doesn't own any items.</p>
        )}

      </div>
    </AppLayout>
  );
}
