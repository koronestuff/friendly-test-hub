import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Korone Test Site — Yubi Yubi!" },
      { name: "description", content: "A tiny test site full of Korone stuff." },
      { property: "og:title", content: "Korone Test Site" },
      { property: "og:description", content: "A tiny test site full of Korone stuff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const [count, setCount] = useState(0);
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-8 px-6 text-center">
      <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Test site</p>
      <h1 className="font-display text-6xl md:text-8xl text-primary">Yubi Yubi!</h1>
      <p className="max-w-md text-lg text-muted-foreground">
        A little corner for Korone stuff. Press the button to collect fingers.
      </p>
      <button
        onClick={() => setCount((c) => c + 1)}
        className="rounded-full bg-primary px-8 py-4 text-xl font-bold text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        🦴 Collect a yubi
      </button>
      <p className="font-display text-3xl">{count} yubi collected</p>
    </main>
  );
}
