export interface CapabilityOption {
  id: string;
  label: string;
}

export const CAPABILITY_OPTIONS: CapabilityOption[] = [
  { id: "calls", label: "Answer Calls" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "appointments", label: "Appointments" },
  { id: "orders", label: "Orders" },
  { id: "support", label: "Customer Support" },
  { id: "leads", label: "Lead Generation" },
  { id: "email", label: "Email" },
  { id: "instagram", label: "Instagram" },
];
