"use client";

import { useEffect, useRef } from "react";

type AuthFeedbackProps = {
  id: string;
  kind: "error" | "success";
  message: string;
};

export default function AuthFeedback({ id, kind, message }: AuthFeedbackProps) {
  const feedbackRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    feedbackRef.current?.focus({ preventScroll: true });
  }, [message]);

  return (
    <p
      ref={feedbackRef}
      id={id}
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
      aria-atomic="true"
      tabIndex={-1}
      className={kind === "error" ? "text-sm text-red-300" : "text-sm text-emerald-300"}
    >
      {message}
    </p>
  );
}
