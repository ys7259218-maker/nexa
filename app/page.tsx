import OnboardingFlow from "../components/onboarding/OnboardingFlow";

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