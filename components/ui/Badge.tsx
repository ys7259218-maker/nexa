"use client";

import { ReactNode } from "react";

type Variant = "success" | "warning" | "danger" | "info";

interface BadgeProps {
  children: ReactNode;
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  success: "bg-green-500/20 text-green-400",
  warning: "bg-yellow-500/20 text-yellow-400",
  danger: "bg-red-500/20 text-red-400",
  info: "bg-blue-500/20 text-blue-400",
};

export default function Badge({
  children,
  variant = "info",
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex
        items-center
        px-3
        py-1
        rounded-full
        text-sm
        font-medium
        ${variants[variant]}
      `}
    >
      {children}
    </span>
  );
}