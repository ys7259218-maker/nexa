import type { Metadata } from "next";
import { LegalPage } from "../../components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy | Nexa AI" };

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="24 August 2026">
      <p>
        Nexa AI helps account owners configure AI employees and manage business communications. This
        policy explains the information processed when you use Nexa AI.
      </p>
      <section>
        <h2>Information we process</h2>
        <ul>
          <li>Account information, such as your email address and authentication session.</li>
          <li>AI employee settings that you choose to save.</li>
          <li>WhatsApp conversation identifiers, messages, and delivery events received for a connected business number.</li>
          <li>Operational records needed to prevent duplicate webhook processing and diagnose failures.</li>
        </ul>
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
          is received from Meta when an account owner connects a number. If the account owner enables the
          optional OpenAI provider, relevant business context and the customer&apos;s message are sent to OpenAI
          to draft a reply. We do not sell personal information. Data is shared only with service providers
          needed to operate Nexa or when legally required.
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
