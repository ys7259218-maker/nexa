import type { Metadata } from "next";
import { LegalPage } from "../../components/LegalPage";

export const metadata: Metadata = { title: "Terms of Service | Nexa AI" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="24 August 2026">
      <p>By using Nexa AI, you agree to these terms.</p>
      <section>
        <h2>Permitted use</h2>
        <p>
          You may use Nexa only for lawful business communications and with accounts, phone numbers, and data
          that you are authorised to manage. You must follow Meta and WhatsApp policies and obtain any consent
          required before contacting customers.
        </p>
      </section>
      <section>
        <h2>Your responsibility</h2>
        <p>
          You are responsible for your account security, configuration, message content, and use of generated
          responses. Do not use Nexa for spam, fraud, harassment, unlawful surveillance, or sensitive decisions.
        </p>
      </section>
      <section>
        <h2>Service availability</h2>
        <p>
          Nexa may depend on third-party services, including Meta, Supabase, and Vercel. Features may be limited
          when those services are unavailable or an external account has not been approved.
        </p>
      </section>
      <section>
        <h2>AI output</h2>
        <p>
          AI-generated output may be incomplete or incorrect. Review important responses before relying on them.
          Nexa is not a substitute for legal, medical, financial, or other professional advice.
        </p>
      </section>
      <section>
        <h2>Changes and termination</h2>
        <p>
          We may update the service or these terms as Nexa develops. Access may be suspended for misuse or to
          protect users and the service. You may stop using Nexa and request deletion at any time.
        </p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>Questions can be sent to <a href="mailto:ys7259218@gmail.com">ys7259218@gmail.com</a>.</p>
      </section>
    </LegalPage>
  );
}
