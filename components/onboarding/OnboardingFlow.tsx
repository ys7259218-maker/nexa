"use client";

import { useState } from "react";
import Dashboard from "../dashboard/Dashboard";
import {
  WelcomeScreen,
  BusinessDescriptionScreen,
  CapabilitiesScreen,
  ReadyScreen,
} from "./OnboardingScreens";

export default function OnboardingFlow() {
  const [step, setStep] = useState(0);

  const [businessDescription, setBusinessDescription] = useState("");
  const [capabilities, setCapabilities] = useState<string[]>([]);

  switch (step) {
    case 0:
      return (
        <WelcomeScreen onNext={() => setStep(1)} />
      );

    case 1:
      return (
        <BusinessDescriptionScreen
          initialValue={businessDescription}
          onNext={(value) => {
            setBusinessDescription(value);
            setStep(2);
          }}
        />
      );

    case 2:
      return (
        <CapabilitiesScreen
          initialValue={capabilities}
          onNext={(value) => {
            setCapabilities(value);
            setStep(3);
          }}
        />
      );

    case 3:
      return (
        <ReadyScreen
          onNext={() => setStep(4)}
        />
      );

       case 4:
      return <Dashboard userEmail="" />;

    default:
      return null;
  }
}