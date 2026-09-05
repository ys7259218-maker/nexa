"use client";

import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-blue-600 hover:bg-blue-500 text-white",

  secondary:
    "bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700",

  ghost:
    "bg-transparent hover:bg-zinc-800 text-white",

  danger:
    "bg-red-600 hover:bg-red-500 text-white",
};

export default function Button({
  variant = "primary",
  className = "",
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`
        px-5
        py-3
        rounded-xl
        font-medium
        transition-all
        duration-200
        disabled:opacity-50
        disabled:cursor-not-allowed
        ${variants[variant]}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}