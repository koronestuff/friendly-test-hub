import { resolveLoginEmail } from "@/lib/login.functions";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, usernameToEmail } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Log in or Sign up — Rawblox" },
      {
        name: "description",
        content: "Create a free Rawblox account or log in to trade limited items.",
      },
      { property: "og:title", content: "Log in or Sign up — Rawblox" },
      {
        property: "og:description",
        content: "Create a free Rawblox account or log in to trade limited items.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/", replace: true });
  }, [loading, session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = username.trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) {
      toast.error("Username must be 3-20 letters, numbers or underscores.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: usernameToEmail(name),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { username: name },
          },
        });
        if (error) {
          toast.error(
            error.message.toLowerCase().includes("already")
              ? "That username is already taken."
              : error.message,
          );
          return;
        }
        toast.success("Welcome to Rawblox! You got 100 starter Rawbux.");
      } else {
        let { error } = await supabase.auth.signInWithPassword({
          email: usernameToEmail(name),
          password,
        });
        if (error) {
          // Account may have been renamed — look up its real sign-in address.
          try {
            const { email } = await resolveLoginEmail({ data: { username: name } });
            if (email && email !== usernameToEmail(name)) {
              ({ error } = await supabase.auth.signInWithPassword({ email, password }));
            }
          } catch {
            /* ignore */
          }
        }
        if (error) {
          toast.error("Incorrect username or password.");
          return;
        }
      }
      await navigate({ to: "/", replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-nav">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center px-4">
          <span className="text-xl font-extrabold tracking-tight">Rawrion Economy Simulator</span>
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="rb-card w-full max-w-sm p-6">
          <h1 className="text-center text-2xl font-bold">
            {mode === "login" ? "Login" : "Sign Up"}
          </h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            {mode === "login" ? "Welcome back to RCES." : "Create your RCES account."}
          </p>
          <form onSubmit={submit} className="mt-5 space-y-3">
            <div>
              <label className="mb-1 block text-sm font-semibold">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary"
                placeholder="Username"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={72}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary"
                placeholder="Password"
              />
            </div>
            <button
              disabled={busy}
              className="h-10 w-full rounded-md bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? "Please wait..." : mode === "login" ? "Log In" : "Sign Up"}
            </button>
          </form>
          <button
            className="mt-4 w-full text-center text-sm font-semibold text-primary hover:underline"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Log in"}
          </button>
        </div>
      </div>
    </div>
  );
}
