"use client";

import Link from "next/link";

export default function Navbar() {
  return (
    <header
      style={{
        height: "72px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 30px",
        borderBottom: "1px solid #222",
        background: "#111",
      }}
    >
      <p
        style={{
          fontSize: "14px",
          margin: 0,
          color: "#a1a1aa",
        }}
      >
        Nexa control center · protected workspace
      </p>

      <nav
        aria-label="Workspace shortcuts"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
        }}
      >
        <Link className="text-sm text-zinc-400 transition hover:text-white" href="/dashboard">
          Dashboard
        </Link>

        <Link className="text-sm text-zinc-400 transition hover:text-white" href="/conversations">
          Inbox
        </Link>

        <Link className="text-sm text-zinc-400 transition hover:text-white" href="/settings/team">
          Team
        </Link>
      </nav>
    </header>
  );
}
