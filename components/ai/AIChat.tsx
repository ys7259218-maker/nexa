"use client";

import { useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type AIChatProps = {
  employeeId: string;
};

export default function AIChat({
  employeeId,
}: AIChatProps) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    const text = message.trim();

    if (!text || loading) return;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: text,
      },
    ]);

    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId,
          message: text,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Failed to get AI response"
        );
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
        },
      ]);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Something went wrong.";

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Sorry, ${errorMessage}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 overflow-hidden">
      <div className="border-b border-zinc-800 px-6 py-5">
        <h2 className="text-xl font-semibold">
          Test Nexa AI
        </h2>

        <p className="text-sm text-zinc-400 mt-1">
          Talk to this AI Employee before deploying it.
        </p>
      </div>

      <div className="min-h-[360px] max-h-[500px] overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="h-[300px] flex items-center justify-center text-center">
            <div>
              <p className="text-zinc-300 font-medium">
                Start a conversation
              </p>

              <p className="text-zinc-500 text-sm mt-2">
                Try: “What services do you provide?”
              </p>
            </div>
          </div>
        )}

        {messages.map((item, index) => (
          <div
            key={index}
            className={`flex ${
              item.role === "user"
                ? "justify-end"
                : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                item.role === "user"
                  ? "bg-white text-black"
                  : "bg-zinc-900 text-zinc-100 border border-zinc-800"
              }`}
            >
              {item.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 px-4 py-3 text-sm text-zinc-400">
              Nexa is thinking...
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800 p-4">
        <div className="flex gap-3">
          <textarea
            value={message}
            onChange={(event) =>
              setMessage(event.target.value)
            }
            onKeyDown={handleKeyDown}
            placeholder="Type a customer message..."
            rows={2}
            disabled={loading}
            className="flex-1 resize-none rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-zinc-600 disabled:opacity-50"
          />

          <button
            type="button"
            onClick={sendMessage}
            disabled={!message.trim() || loading}
            className="self-end rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </div>

        <p className="text-xs text-zinc-600 mt-2">
          Press Enter to send · Shift + Enter for a new line
        </p>
      </div>
    </section>
  );
}