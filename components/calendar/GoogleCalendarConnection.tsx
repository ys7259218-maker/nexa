"use client";

import { useRef, useState } from "react";
import Card from "@/components/ui/Card";

type StatusProps = {
  workspaceId: string;
  connected: boolean;
  provider: string | null;
  calendarId: string | null;
  scopes: string | null;
  tokenExpiresAt: string | null;
  connectedAt: string | null;
};

export default function GoogleCalendarConnection({
  workspaceId,
  connected,
  provider,
  calendarId,
  scopes,
  tokenExpiresAt,
  connectedAt,
}: StatusProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "disconnect" | "configure") {
    setBusy(action);
    setError(null);
    try {
      if (action === "disconnect") {
        const res = await fetch("/api/integrations/google-calendar/disconnect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId }),
        });
        if (!res.ok) throw new Error("disconnect failed");
      } else {
        const calendar = inputRef.current?.value.trim() ?? "";
        if (!calendar) {
          setError("Enter a calendar id first.");
          return;
        }
        const res = await fetch("/api/integrations/google-calendar/configure", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, calendarId: calendar }),
        });
        if (!res.ok) throw new Error("configure failed");
      }
      window.location.reload();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">Google Calendar</h2>
          <p className="text-sm text-zinc-400">
            {connected
              ? `Connected via ${provider ?? "Google"}`
              : "Not connected yet"}
          </p>
        </div>
        {connected ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void run("disconnect")}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-red-500 hover:text-red-400 disabled:opacity-50"
          >
            {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
          </button>
        ) : (
          <a
            href="/api/integrations/google-calendar/connect"
            className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            Connect Calendar
          </a>
        )}
      </div>

      {connected && (
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Calendar id</dt>
            <dd className="font-mono text-xs text-zinc-300">
              {calendarId ?? "not configured"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Scopes</dt>
            <dd className="break-all text-xs text-zinc-300">{scopes}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Token expires</dt>
            <dd className="text-xs text-zinc-300">
              {tokenExpiresAt
                ? new Date(tokenExpiresAt).toLocaleString()
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Connected at</dt>
            <dd className="text-xs text-zinc-300">
              {connectedAt ? new Date(connectedAt).toLocaleString() : "—"}
            </dd>
          </div>
        </dl>
      )}

      {connected && (
        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void run("configure");
          }}
        >
          <input
            ref={inputRef}
            defaultValue={calendarId ?? ""}
            placeholder="Dedicated calendar id (leave empty to not target one)"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-zinc-500"
          />
          <button
            type="submit"
            disabled={busy !== null}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {busy === "configure" ? "Saving…" : "Save"}
          </button>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </Card>
  );
}