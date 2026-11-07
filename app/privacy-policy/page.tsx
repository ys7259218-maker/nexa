import type { Metadata } from "next";
import { LegalPage } from "../../components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy | Nexa AI" };

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="4 October 2026">
      <p>
        Nexa AI helps account owners configure AI employees and manage business communications. This
        policy explains the information processed when you use Nexa AI.
      </p>
      <section>
        <h2>Information we process</h2>
        <ul>
          <li>Account information, such as your email address and authentication session.</li>
          <li>AI employee settings that you choose to save.</li>
          <li>Google Calendar event title and time metadata, if you connect a Google account.</li>
          <li>WhatsApp conversation identifiers, messages, and delivery events received for a connected business number.</li>
          <li>Operational records needed to prevent duplicate webhook processing and diagnose failures.</li>
        </ul>
      </section>
      <section>
        <h2>Google Calendar data</h2>
        <p>
          Google Calendar access is optional and is enabled only when an account owner chooses to
          connect a Google account. Nexa AI requests a single Google permission,{" "}
          <code>https://www.googleapis.com/auth/calendar.events.owned</code>, which allows viewing and
          editing only the events the user created or that are shared with them. Consent is granted
          through Google&apos;s own consent screen, is specific to the user&apos;s Google account, and
          can be revoked at any time from the user&apos;s Google Account permissions page.
        </p>
        <p>
          Nexa AI uses this data to display upcoming appointments and to prevent scheduling conflicts
          while replying to customers. It does not read email, contacts, other calendars, or events the
          user does not own. Tokens and the event metadata derived from them are stored encrypted on
          the server behind role-based access control and are never exposed to the browser. Disconnecting
          the calendar removes the stored connection and its tokens.
        </p>
      </section>
      <section>
        <h2>How information is used</h2>
        <p>
          Information is used only to provide the Nexa service, authenticate users, display account-owned
          records, process connected communications, protect the service, and troubleshoot errors.
        </p>
      </section>
      <section>
        <h2>Storage and sharing</h2>
        <p>
          Application data is stored with Supabase and the application is hosted with Vercel. WhatsApp data
          is received from Meta when an account owner connects a number. Google Calendar event data is
          received from Google only when an account owner connects a Google account, is used only for the
          appointment and conflict-detection purposes described above, and is not shared with any third
          party. If the account owner enables the
          optional AI provider, relevant business context and the customer&apos;s message are sent to that
          provider to draft a reply. We do not sell personal information. Data is shared only with service
          providers needed to operate Nexa or when legally required.
        </p>
      </section>
      <section>
        <h2>Security and retention</h2>
        <p>
          Access controls restrict account data to its owner. Secrets remain server-side. Operational webhook
          records are retained only as needed for reliable processing and security. Conversation records remain
          until the account owner deletes them or requests deletion.
        </p>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>
          You may disconnect a WhatsApp channel or request deletion of your Nexa data. See the
          <a href="/data-deletion"> Data Deletion page</a> for instructions.
        </p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>
          Privacy and deletion questions can be sent to <a href="mailto:ys7259218@gmail.com">ys7259218@gmail.com</a>.
        </p>
      </section>
    </LegalPage>
  );
}
