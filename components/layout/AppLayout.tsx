"use client";

import { ReactNode } from "react";
import Sidebar from "../dashboard/Sidebar";
import Navbar from "../dashboard/Navbar";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({
  children,
}: AppLayoutProps) {
  return (
    <div
      className="flex min-h-screen flex-col bg-black text-white lg:flex-row"
    >
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar />

        <main id="main-content" tabIndex={-1} className="flex-1 p-4 sm:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
