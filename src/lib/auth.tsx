import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  username: string;
  description: string;
  rawbux: number;
  last_daily_at: string;
  is_banned: boolean;
  ban_reason: string | null;
  ban_until: string | null;
  created_at: string;
  inventory_private?: boolean;
};

type AuthValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthValue>({
  session: null,
  profile: null,
  loading: true,
  refresh: async () => {},
});

export function usernameToEmail(username: string) {
  return `${username.trim().toLowerCase()}@rawblox.local`;
}

// Keep the same session object when nothing meaningful changed, so the whole app
// doesn't re-render every time Supabase repeats an auth event.
function sameSession(a: Session | null, b: Session | null) {
  if (!a || !b) return a === b;
  return a.access_token === b.access_token && a.user.id === b.user.id;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const lastUserId = useRef<string | undefined>(undefined);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile((data as Profile) ?? null);
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSession((prev) => (sameSession(prev, data.session) ? prev : data.session));
    lastUserId.current = data.session?.user.id;
    await loadProfile(data.session?.user.id);
  }, [loadProfile]);

  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession((prev) => (sameSession(prev, next) ? prev : next));
      // These events don't change who is logged in, so the profile doesn't need reloading.
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;
      const uid = next?.user.id;
      if (uid === lastUserId.current) return; // same user as before (e.g. tab regained focus)
      lastUserId.current = uid;
      setTimeout(() => {
        void loadProfile(uid);
      }, 0);
    });

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSession(data.session);
      const uid = data.session?.user.id;
      lastUserId.current = uid;
      if (uid) {
        // Show the site as soon as the profile is here...
        await loadProfile(uid);
        if (!active) return;
        setLoading(false);
        // ...and claim the daily reward in the background afterwards.
        await supabase.rpc("claim_daily");
        if (!active) return;
        await loadProfile(uid);
      } else {
        setLoading(false);
      }
    })();

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo(
    () => ({ session, profile, loading, refresh }),
    [session, profile, loading, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
