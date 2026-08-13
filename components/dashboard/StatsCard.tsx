"use client";

interface StatsCardProps {
  title: string;
  value: string;
}

export default function StatsCard({
  title,
  value,
}: StatsCardProps) {
  return (
    <div
      style={{
        background: "#111",
        border: "1px solid #222",
        borderRadius: "14px",
        padding: "24px",
      }}
    >
      <p
        style={{
          color: "#888",
          fontSize: "14px",
          marginBottom: "10px",
        }}
      >
        {title}
      </p>

      <h2
        style={{
          fontSize: "32px",
          margin: 0,
        }}
      >
        {value}
      </h2>
    </div>
  );
}