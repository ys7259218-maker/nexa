"use client";

type PasswordToggleProps = {
  shown: boolean;
  onToggle: () => void;
};

export default function PasswordToggle({ shown, onToggle }: PasswordToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={shown}
      aria-label={shown ? "Hide password" : "Show password"}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-400 transition hover:text-white"
    >
      {shown ? "Hide" : "Show"}
    </button>
  );
}