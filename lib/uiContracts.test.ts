import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function collectTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectTsxFiles(path);
    }

    return entry.isFile() && entry.name.endsWith(".tsx") ? [path] : [];
  });
}

function readRepositoryFile(path: string): string {
  return readFileSync(join(repositoryRoot, path), "utf8");
}

test("reachable UI source contains no placeholder hash destinations", () => {
  const files = [
    ...collectTsxFiles(join(repositoryRoot, "app")),
    ...collectTsxFiles(join(repositoryRoot, "components")),
  ];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const relativePath = file.slice(repositoryRoot.length + 1);

    assert.doesNotMatch(
      source,
      /href\s*=\s*["']#["']/,
      `${relativePath} must not expose href="#"`,
    );
    assert.doesNotMatch(
      source,
      /\?\?\s*["']#["']/,
      `${relativePath} must not fall back to a placeholder hash`,
    );
  }
});

test("dashboard names the generic WhatsApp count as activity records", () => {
  const dashboardComponent = readRepositoryFile("components/dashboard/Dashboard.tsx");
  const dashboardModel = readRepositoryFile("lib/dashboard.ts");

  assert.match(dashboardComponent, /title: "WhatsApp activity records"/);
  assert.match(dashboardComponent, /snapshot\.whatsappActivityRecords/);
  assert.doesNotMatch(dashboardComponent, /WhatsApp Replies|whatsappReplies/);

  assert.match(dashboardModel, /whatsappActivityRecords: number/);
  assert.match(dashboardModel, /\.eq\("category", "whatsapp"\)/);
  assert.doesNotMatch(dashboardModel, /whatsappReplies/);
});

test("dashboard fragment shortcuts never claim a separate active page", () => {
  const sidebar = readRepositoryFile("components/dashboard/Sidebar.tsx");
  const quickActions = readRepositoryFile("components/dashboard/QuickActions.tsx");

  for (const destination of ["calls", "appointments", "analytics"]) {
    assert.match(sidebar, new RegExp(`/dashboard#${destination}`));
    assert.match(quickActions, new RegExp(`/dashboard#${destination}`));
  }

  assert.match(sidebar, /const isFragmentShortcut = item\.href\.includes\("#"\)/);
  assert.match(sidebar, /!isFragmentShortcut/);
  assert.match(sidebar, /aria-current=\{isActive \? "page" : undefined\}/);
});
