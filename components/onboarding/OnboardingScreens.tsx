"use client";

import { useState } from "react";
import {
  OnboardingButton,
  CapabilityChip,
} from "./OnboardingUI";
import { CAPABILITY_OPTIONS } from "../../lib/onboardingData";

interface WelcomeScreenProps {
  onNext: () => void;
}

export function WelcomeScreen({
  onNext,
}: WelcomeScreenProps) {
  return (
    <div style={{ textAlign: "center" }}>
      <h1
        style={{
          fontSize: "34px",
          fontWeight: "bold",
          marginBottom: "12px",
        }}
      >
        Welcome to Nexa
      </h1>

      <p
        style={{
          color: "#999",
          fontSize: "16px",
          marginBottom: "40px",
        }}
      >
        Let's build your first AI Employee.
      </p>

      <OnboardingButton onClick={onNext}>
        Get Started
      </OnboardingButton>
    </div>
  );
}

interface BusinessDescriptionScreenProps {
  initialValue: string;
  onNext: (value: string) => void;
}

export function BusinessDescriptionScreen({
  initialValue,
  onNext,
}: BusinessDescriptionScreenProps) {
  const [value, setValue] = useState(initialValue);

  const isValid = value.trim().length >= 10;

  return (
    <div>
      <h2>Tell Nexa about your business</h2>

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Example: We repair ACs in Delhi."
        rows={5}
      />

      <OnboardingButton
        onClick={() => onNext(value.trim())}
        disabled={!isValid}
      >
        Continue
      </OnboardingButton>
    </div>
  );
}

interface CapabilitiesScreenProps {
  initialValue: string[];
  onNext: (value: string[]) => void;
}
export function CapabilitiesScreen({
  initialValue,
  onNext,
}: CapabilitiesScreenProps) {
  const [selected, setSelected] = useState<string[]>(initialValue);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    );
  }

  return (
    <div>
      <h2>What would you like Nexa to handle?</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px",
          marginBottom: "24px",
        }}
      >
        {CAPABILITY_OPTIONS.map((option) => (
          <CapabilityChip
            key={option.id}
            label={option.label}
            selected={selected.includes(option.id)}
            onToggle={() => toggle(option.id)}
          />
        ))}
      </div>

      <OnboardingButton
        onClick={() => onNext(selected)}
        disabled={selected.length === 0}
      >
        Continue
      </OnboardingButton>
    </div>
  );
}
interface ReadyScreenProps {
  onNext: () => void;
}

export function ReadyScreen({
  onNext,
}: ReadyScreenProps) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "48px" }}>✅</div>

      <h2>Perfect!</h2>

      <p>I understand your business.</p>

      <p>Your first AI Employee is ready.</p>

      <OnboardingButton onClick={onNext}>
        Continue
      </OnboardingButton>
    </div>
  );
}
