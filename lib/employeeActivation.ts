import type { AIEmployee } from "./aiEmployees";

export type ActivationCheck = { key: string; label: string; ready: boolean; detail: string };
const hasText = (value: string) => value.trim().length > 0;

export function buildActivationChecklist(employee: AIEmployee, channel: { linked: boolean; webhookConfigured: boolean; inboundReady: boolean; outboundEnabled: boolean }): ActivationCheck[] {
  const hasKnowledge = [employee.knowledge_website, employee.knowledge_faq_document, employee.knowledge_pdf_url, employee.knowledge_notes].some(hasText);
  return [
    { key: "identity", label: "Identity", ready: hasText(employee.name) && hasText(employee.business_name) && hasText(employee.department), detail: "Name, business, and department are required." },
    { key: "behavior", label: "Business behavior", ready: hasText(employee.business_description) && hasText(employee.greeting_message) && hasText(employee.timezone) && hasText(employee.working_hours), detail: "Description, greeting, timezone, and working hours are required." },
    { key: "voice", label: "Language and voice", ready: hasText(employee.language) && hasText(employee.voice), detail: "Language and voice must be selected." },
    { key: "knowledge", label: "Verified knowledge", ready: hasKnowledge, detail: "Add at least one reviewed knowledge source or note." },
    { key: "channel", label: "WhatsApp channel", ready: channel.linked && channel.webhookConfigured, detail: "Link a Phone Number ID and configure the signed webhook." },
    { key: "runtime", label: "Inbound runtime", ready: channel.inboundReady, detail: "The secure server-side processor must be configured." },
    { key: "outbound", label: "Production outbound", ready: channel.outboundEnabled, detail: "Blocked until Meta registration and controlled testing pass." },
  ];
}

export const isActivationReady = (checks: ActivationCheck[]) => checks.every((check) => check.ready);
