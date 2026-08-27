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
        Let&apos;s build your first AI Employee.
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
        maxLength={1000}
        rows={5}
      />

      <p style={{ color: "#777", fontSize: "12px", marginTop: "8px" }}>
        {value.length}/1000 · Preview only; this is not saved.
      </p>

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

      <p style={{ color: "#999", fontSize: "13px", lineHeight: 1.5, marginBottom: "18px" }}>
        Planning preview only. Selecting an item does not enable it. WhatsApp inbound has a
        guarded foundation; outbound WhatsApp and all other channels remain planned.
      </p>

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

      <h2>Your plan is ready</h2>

      <p>Nexa has enough information to guide your setup.</p>

      <p>Create a secure account to build and configure the real AI Employee.</p>

      <OnboardingButton onClick={onNext}>
        Create secure account
      </OnboardingButton>
    </div>
  );
}
