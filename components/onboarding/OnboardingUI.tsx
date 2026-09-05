"use client";

import type { ReactNode } from "react";

interface OnboardingButtonProps {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export function OnboardingButton({
  children,
  onClick,
  disabled = false,
}: OnboardingButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "16px",
        border: "none",
        borderRadius: "10px",
        background: disabled ? "#1f1f1f" : "#4FC3F7",
        color: disabled ? "#777" : "#000",
        fontSize: "16px",
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "0.2s",
      }}
    >
      {children}
    </button>
  );
}

interface StepDotsProps {
  total: number;
  current: number;
}

export function StepDots({
  total,
  current,
}: StepDotsProps) {
  return (
    <>
      <p className="sr-only" aria-live="polite">
        Step {current + 1} of {total}
      </p>
      <div
        aria-hidden="true"
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "8px",
          marginBottom: "30px",
        }}
      >
        {Array.from({ length: total }).map((_, index) => (
          <div
            key={index}
            style={{
              width: index === current ? "24px" : "8px",
              height: "8px",
              borderRadius: "999px",
              background:
                index <= current ? "#4FC3F7" : "#2A2A2A",
              transition: "0.3s",
            }}
          />
        ))}
      </div>
    </>
  );
}

interface CapabilityChipProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
}

export function CapabilityChip({
  label,
  selected,
  onToggle,
}: CapabilityChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      style={{
        padding: "14px",
        borderRadius: "10px",
        border: selected
          ? "1px solid #4FC3F7"
          : "1px solid #2A2A2A",
        background: selected
          ? "rgba(79,195,247,0.12)"
          : "#0A0A0A",
        color: selected ? "#4FC3F7" : "#CCCCCC",
        cursor: "pointer",
        textAlign: "left",
        fontSize: "14px",
        fontWeight: 500,
      }}
    >
      {selected ? "✓ " : ""}
      {label}
    </button>
  );
}