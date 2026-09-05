import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Nexa AI",
  description: "Build and manage AI employees for your business.",
};

export const viewport: Viewport = {
  themeColor: "#09090b",
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
