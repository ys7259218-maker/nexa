import type { SupabaseClient } from "@supabase/supabase-js";

export type CallStatus = "Completed" | "Booked" | "Missed";

export type CallRecord = {
  id: string;
  user_id: string;
  ai_employee_id: string | null;
  customer: string;
  status: CallStatus;
  duration_seconds: number;
  created_at: string;
};

export type AppointmentStatus = "Confirmed" | "Pending";

export type AppointmentRecord = {
  id: string;
  user_id: string;
  ai_employee_id: string | null;
  customer: string;
  service: string;
  location: string;
  scheduled_at: string;
  status: AppointmentStatus;
};

export type ActivityCategory = "general" | "calls" | "appointments" | "whatsapp";

export type ActivityEvent = {
  id: string;
  user_id: string;
  category: ActivityCategory;
  message: string;
};

export type WeeklyPoint = { day: string; calls: number };

export type DashboardSnapshot = {
  callsToday: number;
  upcomingAppointments: number;
  whatsappActivityRecords: number;
  successRatePercent: number | null;
  weeklyCalls: WeeklyPoint[];
  recentCalls: CallRecord[];
  appointments: AppointmentRecord[];
  activities: ActivityEvent[];
};

export type SnapshotResult =
  | { error: string; snapshot: null }
  | { error: null; snapshot: DashboardSnapshot };

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Builds a seven-point series labelled by weekday, oldest first, ending
 * today. Buckets are derived from the signed-in user's real call rows;
 * days without calls stay at zero instead of being faked.
 */
export function buildWeeklySeries(
  now: Date,
  calls: Array<{ created_at: string }>,
): WeeklyPoint[] {
  const series: WeeklyPoint[] = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(startOfDay(now));
    day.setDate(day.getDate() - offset);
    const label = DAY_LABELS[day.getDay()];

    series.push({
      day: label,
      calls: calls.filter((call) =>
        isSameLocalDay(new Date(call.created_at), day),
      ).length,
    });
  }

  return series;
}

export function computeSuccessRatePercent(
  calls: Array<{ status: CallStatus }>,
): number | null {
  if (calls.length === 0) {
    return null;
  }

  const completed = calls.filter((call) => call.status === "Completed").length;
  return Math.round((completed / calls.length) * 100);
}

/**
 * Every read runs through Supabase with the signed-in user's cookie
 * session; RLS scopes calls, appointments, and activity_events to their
 * owner. The service-role key is never used here.
 */
export async function getDashboardSnapshot(
  client: SupabaseClient,
  now: Date = new Date(),
): Promise<SnapshotResult> {
  const weekStart = startOfDay(now);
  weekStart.setDate(weekStart.getDate() - 6);
  const todayStart = startOfDay(now);

  const [recentCallsResult, weekCallsResult, appointmentsResult, appointmentCountResult, activitiesResult, whatsappActivityCountResult] =
    await Promise.all([
      client
        .from("calls")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5),
      client
        .from("calls")
        .select("created_at,status")
        .gte("created_at", weekStart.toISOString()),
      client
        .from("appointments")
        .select("*")
        .gte("scheduled_at", todayStart.toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(5),
      client
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .gte("scheduled_at", todayStart.toISOString()),
      client
        .from("activity_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6),
      client
        .from("activity_events")
        .select("id", { count: "exact", head: true })
        .eq("category", "whatsapp"),
    ]);

  const firstError =
    recentCallsResult.error ??
    weekCallsResult.error ??
    appointmentsResult.error ??
    appointmentCountResult.error ??
    activitiesResult.error ??
    whatsappActivityCountResult.error;

  if (firstError) {
    return { error: firstError.message, snapshot: null };
  }

  const weekCalls = (weekCallsResult.data ?? []) as Array<{
    created_at: string;
    status: CallStatus;
  }>;

  const snapshot: DashboardSnapshot = {
    callsToday: weekCalls.filter((call) =>
      isSameLocalDay(new Date(call.created_at), now),
    ).length,
    upcomingAppointments: appointmentCountResult.count ?? 0,
    whatsappActivityRecords: whatsappActivityCountResult.count ?? 0,
    successRatePercent: computeSuccessRatePercent(weekCalls),
    weeklyCalls: buildWeeklySeries(now, weekCalls),
    recentCalls: (recentCallsResult.data ?? []) as CallRecord[],
    appointments: (appointmentsResult.data ?? []) as AppointmentRecord[],
    activities: (activitiesResult.data ?? []) as ActivityEvent[],
  };

  return { error: null, snapshot };
}

export async function recordActivityEvent(
  client: SupabaseClient,
  input: { message: string; category?: ActivityCategory },
): Promise<{ error: string | null }> {
  const { error } = await client.from("activity_events").insert({
    message: input.message.trim(),
    category: input.category ?? "general",
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export function formatCallDuration(durationSeconds: number): string {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}
