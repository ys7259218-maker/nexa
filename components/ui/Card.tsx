"use client";

import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export default function Card({
  children,
  className = "",
}: CardProps) {
  return (
    <div
      className={`
        rounded-3xl
        border
        border-white/10
        bg-white/5
        backdrop-blur-xl
        p-6
        shadow-2xl
        shadow-black/30
        hover:border-cyan-400/30
        hover:shadow-cyan-500/10
        transition-all
        duration-300
        ${className}
      `}
    >
      {children}
    </div>
  );
}