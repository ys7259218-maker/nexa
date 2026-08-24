import type { Metadata } from "next";
import { LegalPage } from "../../components/LegalPage";

export const metadata: Metadata = { title: "Data Deletion | Nexa AI" };

export default function DataDeletionPage() {
  return (
    <LegalPage title="Data Deletion Instructions" updated="24 August 2026">
      <p>You can request deletion of information associated with your Nexa AI account.</p>
      <section>
        <h2>How to request deletion</h2>
        <ul>
          <li>Email <a href="mailto:ys7259218@gmail.com?subject=Nexa%20data%20deletion%20request">ys7259218@gmail.com</a> from the email address used for your Nexa account.</li>
          <li>Use the subject “Nexa data deletion request”.</li>
          <li>Do not include passwords, access tokens, PINs, or customer message contents.</li>
        </ul>
      </section>
      <section>
        <h2>What happens next</h2>
        <p>
          We will verify account ownership and delete account-owned AI employee settings, connected WhatsApp
          channel records, conversations, messages, appointments, calls, and related activity records. Some
          minimal security or legal records may be retained when required, then removed when no longer needed.
        </p>
      </section>
      <section>
        <h2>Timing</h2>
        <p>We aim to acknowledge requests promptly and complete verified deletion requests within 30 days.</p>
      </section>
    </LegalPage>
  );
}
