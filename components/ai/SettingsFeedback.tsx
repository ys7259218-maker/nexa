"use client";

import { useEffect, useRef } from "react";

export type SettingsMessage = {
  type: "error" | "success";
  text: string;
};

export default function SettingsFeedback({ id, message }: { id: string; message: SettingsMessage }) {
  const feedbackRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    feedbackRef.current?.focus({ preventScroll: true });
  }, [message]);

  return (
    <p
      ref={feedbackRef}
      id={id}
      role={message.type === "error" ? "alert" : "status"}
      aria-live={message.type === "error" ? "assertive" : "polite"}
      aria-atomic="true"
      tabIndex={-1}
      className={message.type === "error" ? "text-sm text-red-300" : "text-sm text-emerald-300"}
    >
      {message.text}
    </p>
  );
}
