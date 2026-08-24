import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nexa AI",
  description: "Build and manage AI employees for your business.",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
