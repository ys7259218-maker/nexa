"use client";

import type { ActivityEvent } from "@/lib/dashboard";

type RecentActivityProps = {
  activities: ActivityEvent[];
};

export default function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <section
      aria-labelledby="recent-activity-heading"
      style={{
        marginTop: "40px",
        background: "#111",
        border: "1px solid #222",
        borderRadius: "14px",
        padding: "24px",
      }}
    >
      <h2 id="recent-activity-heading" style={{ marginBottom: "20px" }}>
        Recent Activity
      </h2>

      {activities.length === 0 ? (
        <p role="status" style={{ color: "#71717A" }}>
          No activity yet. Changes to your AI Employees will be logged here.
        </p>
      ) : (
        <ul aria-label="Stored activity records">
          {activities.map((activity) => (
            <li
              key={activity.id}
              style={{
                marginBottom: "12px",
              }}
            >
              {activity.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
