import type { Metadata } from "next";
import OnboardingFlow from "../components/onboarding/OnboardingFlow";

export const metadata: Metadata = {
  title: "Welcome | Nexa AI",
  description: "Let's build your first AI Employee.",
};

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        background: "#000",
        color: "#fff",
      }}
    >
      <OnboardingFlow />
    </main>
  );
}