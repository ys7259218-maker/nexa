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
      className="flex min-h-screen bg-black text-white"
    >
      <Sidebar />

      <div className="flex flex-1 flex-col">
        <Navbar />

        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}