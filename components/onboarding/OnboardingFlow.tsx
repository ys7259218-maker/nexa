"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  WelcomeScreen,
  BusinessDescriptionScreen,
  CapabilitiesScreen,
  ReadyScreen,
} from "./OnboardingScreens";
import { StepDots } from "./OnboardingUI";

export default function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const [businessDescription, setBusinessDescription] = useState("");
  const [capabilities, setCapabilities] = useState<string[]>([]);

  const stepRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    stepRef.current?.focus({ preventScroll: true });
  }, [step]);

  let screen;
  switch (step) {
    case 0:
      screen = <WelcomeScreen onNext={() => setStep(1)} />;
      break;

    case 1:
      screen = (
        <BusinessDescriptionScreen
          initialValue={businessDescription}
          onNext={(value) => {
            setBusinessDescription(value);
            setStep(2);
          }}
        />
      );
      break;

    case 2:
      screen = (
        <CapabilitiesScreen
          initialValue={capabilities}
          onNext={(value) => {
            setCapabilities(value);
            setStep(3);
          }}
        />
      );
      break;

    case 3:
      screen = <ReadyScreen onNext={() => router.push("/signup")} />;
      break;

    default:
      screen = <WelcomeScreen onNext={() => setStep(1)} />;
  }

  return (
    <div ref={stepRef} tabIndex={-1} className="outline-none">
      <StepDots total={4} current={step} />
      {screen}
    </div>
  );
}