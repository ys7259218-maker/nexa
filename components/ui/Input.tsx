"use client";

import { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export default function Input({
  className = "",
  ...props
}: InputProps) {
  return (
    <input
      className={`
        w-full
        px-4
        py-3
        rounded-xl
        bg-zinc-900
        border
        border-zinc-800
        text-white
        placeholder:text-zinc-500
        focus:outline-none
        focus:ring-2
        focus:ring-blue-500
        transition-all
        ${className}
      `}
      {...props}
    />
  );
}
