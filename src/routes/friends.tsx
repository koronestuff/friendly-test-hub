import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchProfiles, rpcMessage, type MiniProfile } from "@/lib/social";

export const Route = createFileRoute("/friends")({
  head: () => ({
    meta: [
      { title: "Friends — Rawblox" },
      {
        name: "description",
        content: "Your Rawblox friend requests, friends, followers and following.",
      },
      { property: "og:title", content: "Friends — Rawblox" },
      {
        property: "og:description",
        content: "Your Rawblox friend requests, friends, followers and following.",
      },
    ],
  }),
  component: FriendsPage,
});

const TABS = ["Friend Requests", "Friends", "Followers", "Following"] as const;

type Row = { key: string; profile: MiniProfile; action?: React.ReactNode };

function compact(list: (MiniProfile | undefined)[]): MiniProfile[] {
  return list.filter((p): p is MiniProfile => !!p);
}

function FriendsPage() {
  const [tab, setTab] = useState<string>(TABS[0]);
  const { session } = useAuth();
  const me = session?.user.id;
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    enabled: !!me,
    queryKey: ["social", me],
    queryFn: async () => {
      const [reqs, friendships, followers, following] = await Promise.all([
        supabase
          .from("friend_requests")
          .select("id, sender_id")
          .eq("receiver_id", me!)
          .eq("status", "pending"),
        supabase.from("friendships").select("user_a, user_b").or(`user_a.eq.${me},user_b.eq.${me}`),
        supabase.from("follows").select("follower_id").eq("following_id", me!),
        supabase.from("follows").select("following_id").eq("follower_id", me!),
      ]);
      const friendIds = (friendships.data ?? []).map((f) => (f.user_a === me ? f.user_b : f.user_a));
      const ids = [
        ...(reqs.data ?? []).map((r) => r.sender_id),
        ...friendIds,
        ...(followers.data ?? []).map((f) => f.follower_id),
        ...(following.data ?? []).map((f) => f.following_id),
      ];
      const profiles = await fetchProfiles(ids);
      return {
        requests: (reqs.data ?? []).map((r) => ({ id: r.id, sender: profiles[r.sender_id] })),
        friends: friendIds.map((id) => profiles[id]),
        followers: (followers.data ?? []).map((f) => profiles[f.follower_id]),
        following: (following.data ?? []).map((f) => profiles[f.following_id]),
      };
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["social"] });

  async function respond(id: string, accept: boolean) {
    const msg = await rpcMessage(
      await supabase.rpc("respond_friend_request", { _request_id: id, _accept: accept }),
    );
    if (msg !== "ok") toast.error(msg);
    else toast.success(accept ? "Friend request accepted." : "Friend request declined.");
    refresh();
  }

  async function unfriend(id: string) {
    const msg = await rpcMessage(await supabase.rpc("remove_friend", { _other: id }));
    if (msg !== "ok") toast.error(msg);
    else toast.success("Friend removed.");
    refresh();
  }

  async function unfollow(id: string) {
    const msg = await rpcMessage(await supabase.rpc("set_follow", { _target: id, _follow: false }));
    if (msg !== "ok") toast.error(msg);
    refresh();
  }

  let rows: Row[] = [];
  if (data) {
    if (tab === "Friend Requests") {
      rows = data.requests
        .filter((r) => r.sender)
        .map((r) => ({
          key: r.id,
          profile: r.sender!,
          action: (
            <div className="flex gap-2">
              <button
                onClick={() => respond(r.id, true)}
                className="rounded-md bg-buy px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90"
              >
                Accept
              </button>
              <button
                onClick={() => respond(r.id, false)}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-bold hover:bg-surface"
              >
                Decline
              </button>
            </div>
          ),
        }));
    } else if (tab === "Friends") {
      rows = compact(data.friends).map((p) => ({
        key: p.id,
        profile: p,
        action: (
          <div className="flex gap-2">
            <Link
              to="/trade/new/$username"
              params={{ username: p.username }}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              Trade
            </Link>
            <button
              onClick={() => unfriend(p.id)}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-bold hover:bg-surface"
            >
              Unfriend
            </button>
          </div>
        ),
      }));
    } else if (tab === "Followers") {
      rows = compact(data.followers).map((p) => ({ key: p.id, profile: p }));
    } else {
      rows = compact(data.following).map((p) => ({
        key: p.id,
        profile: p,
        action: (
          <button
            onClick={() => unfollow(p.id)}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-bold hover:bg-surface"
          >
            Unfollow
          </button>
        ),
      }));
    }
  }

  return (
    <AppLayout>
      <div className="rb-card p-4">
        <h1 className="rb-heading">Friends</h1>
        <div className="mb-4 flex flex-wrap gap-2 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
                tab === t
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No {tab.toLowerCase()} yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.key} className="flex items-center gap-3 py-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded bg-surface text-sm font-bold text-muted-foreground">
                  {r.profile.username.charAt(0).toUpperCase()}
                </div>
                <Link
                  to="/users/$username"
                  params={{ username: r.profile.username }}
                  className="flex-1 text-sm font-semibold hover:text-primary"
                >
                  {r.profile.username}
                </Link>
                {r.action}
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  );
}
