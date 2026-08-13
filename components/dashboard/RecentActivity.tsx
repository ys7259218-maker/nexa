"use client";

const activities = [
  "🤖 AI answered 12 customer calls",
  "💬 28 WhatsApp messages replied",
  "📅 5 appointments booked",
  "⭐ Customer satisfaction updated",
];

export default function RecentActivity() {
  return (
    <div
      style={{
        marginTop: "40px",
        background: "#111",
        border: "1px solid #222",
        borderRadius: "14px",
        padding: "24px",
      }}
    >
      <h2 style={{ marginBottom: "20px" }}>
        Recent Activity
      </h2>

      {activities.map((item) => (
        <p
          key={item}
          style={{
            marginBottom: "12px",
          }}
        >
          {item}
        </p>
      ))}
    </div>
  );
}