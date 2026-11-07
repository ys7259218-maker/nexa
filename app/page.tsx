import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AI Employees for Small Business | Nexa AI",
  description:
    "Nexa AI is a business operating system for small businesses. Configure AI employees, connect your Google Calendar, and handle customer conversations from one inbox.",
};

const CAPABILITIES = [
  {
    title: "AI employees you configure",
    body: "Give each AI employee a name, business role, greeting, working hours, and timezone. Every employee is reviewed against an activation checklist before it handles live conversations.",
  },
  {
    title: "One inbox for customer conversations",
    body: "Connect a WhatsApp Business number and see customer messages, AI-drafted replies, and delivery status in a single review queue instead of scattered personal devices.",
  },
  {
    title: "Calendar-aware scheduling",
    body: "Optionally connect Google Calendar so your team can see upcoming appointments and avoid double-booking while replying to customers.",
  },
];

const GOOGLE_CALENDAR_POINTS = [
  "Nexa AI requests exactly one Google permission: calendar.events.owned — view and edit only the events you created or that are shared with you.",
  "Access is granted by you, through Google's own consent screen, for your own Google account. You can revoke it at any time from your Google Account permissions page.",
  "Nexa AI never reads your email, contacts, other calendars, or events you do not own.",
  "The data is used for one purpose: showing your business upcoming appointments and preventing scheduling conflicts while replying to customers.",
  "Tokens are stored encrypted, server-side, behind role-based access control, and are never exposed to the browser.",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-200">
      <div className="mx-auto max-w-4xl px-5 py-12 sm:py-16">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-lg font-bold text-white">Nexa AI</p>
          <nav aria-label="Account" className="flex items-center gap-5 text-sm">
            <Link href="/login" className="text-zinc-300 hover:text-cyan-300">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-zinc-950 hover:bg-cyan-400"
            >
              Get started
            </Link>
          </nav>
        </header>

        <section className="mt-12">
          <h1 className="text-3xl font-bold leading-tight text-white sm:text-5xl">
            Run your customer conversations with AI employees
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
            Nexa AI is a business operating system that helps small businesses manage customer-facing
            work from one inbox. You configure AI employees, connect the channels your customers already
            use, and keep every reply under your review before it is sent.
          </p>
        </section>

        <section aria-labelledby="capabilities" className="mt-14">
          <h2 id="capabilities" className="text-2xl font-semibold text-white">
            What Nexa AI does
          </h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            {CAPABILITIES.map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5"
              >
                <h3 className="font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-300">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="google-calendar" className="mt-14 rounded-2xl border border-white/10 bg-zinc-900/70 p-6 sm:p-8">
          <h2 id="google-calendar" className="text-2xl font-semibold text-white">
            Google Calendar integration and how your data is used
          </h2>
          <p className="mt-3 leading-7 text-zinc-300">
            Google Calendar is optional. You choose whether to connect it, per business account. The
            permission we request is:
          </p>
          <p className="mt-4 rounded-lg border border-white/10 bg-zinc-950 px-4 py-3 font-mono text-sm break-all text-cyan-300">
            https://www.googleapis.com/auth/calendar.events.owned
          </p>
          <ul className="mt-5 list-disc space-y-3 pl-6 leading-7 text-zinc-300">
            {GOOGLE_CALENDAR_POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <p className="mt-5 leading-7 text-zinc-300">
            A broader calendar permission is not required: read-only permissions would prevent your
            team from creating appointments, and full-calendar permissions would expose calendars you do
            not own. A dedicated data deletion page explains how to remove your data and disconnect
            integrations.
          </p>
        </section>

        <section aria-labelledby="legal" className="mt-14 border-t border-white/10 pt-8">
          <h2 id="legal" className="text-2xl font-semibold text-white">
            Legal and data
          </h2>
          <nav aria-label="Legal pages" className="mt-4 flex flex-wrap gap-5 text-sm">
            <Link href="/privacy-policy" className="text-cyan-400 underline hover:text-cyan-300">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-cyan-400 underline hover:text-cyan-300">
              Terms of Service
            </Link>
            <Link href="/data-deletion" className="text-cyan-400 underline hover:text-cyan-300">
              Data Deletion
            </Link>
          </nav>
          <p className="mt-5 text-sm text-zinc-400">
            Questions about privacy or Google Calendar access? Email{" "}
            <a href="mailto:ys7259218@gmail.com" className="text-cyan-400 underline">
              ys7259218@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}