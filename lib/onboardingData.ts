export interface OnboardingData {
  businessDescription: string;
  capabilities: string[];
  createdAt?: string;
}

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

const STORAGE_KEY = "nexa-onboarding";

export function saveOnboarding(
  data: Omit<OnboardingData, "createdAt">
): OnboardingData {
  const record: OnboardingData = {
    ...data,
    createdAt: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  }

  return record;
}

export function getOnboarding(): OnboardingData | null {
  if (typeof window === "undefined") {
    return null;
  }

  const data = localStorage.getItem(STORAGE_KEY);

  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data) as OnboardingData;
  } catch {
    return null;
  }
}
