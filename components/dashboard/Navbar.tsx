"use client";

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
      <h2
        style={{
          fontSize: "24px",
          margin: 0,
        }}
      >
        Dashboard
      </h2>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
        }}
      >
        <span>🔍 Search</span>

        <span>🔔</span>

        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: "#333",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          👤
        </div>
      </div>
    </header>
  );
}