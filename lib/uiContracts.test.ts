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

test("ResetPasswordForm enforces accessible password and confirmation inputs", () => {
  const source = readRepositoryFile("components/auth/ResetPasswordForm.tsx");

  assert.match(
    source,
    /label\s+htmlFor="password"/,
    "ResetPasswordForm must label the password input",
  );
  assert.match(
    source,
    /id="password"/,
    "ResetPasswordForm must provide an id for the password input",
  );
  assert.match(
    source,
    /label\s+htmlFor="password-confirmation"/,
    "ResetPasswordForm must label the confirmation input",
  );
  assert.match(
    source,
    /id="password-confirmation"/,
    "ResetPasswordForm must provide an id for the confirmation input",
  );
  assert.match(
    source,
    /aria-invalid=\{!!errorMessage\}/,
    "ResetPasswordForm must surface error state to screen readers",
  );
});

test("public auth forms expose visible labels, pending state, and focused feedback", () => {
  const feedback = readRepositoryFile("components/auth/AuthFeedback.tsx");
  const forms = [
    "components/auth/LoginForm.tsx",
    "components/auth/SignupForm.tsx",
    "components/auth/ForgotPasswordForm.tsx",
    "components/auth/ResetPasswordForm.tsx",
  ].map(readRepositoryFile);

  assert.match(feedback, /feedbackRef\.current\?\.focus\(\)/);
  assert.match(feedback, /aria-live=\{kind === "error" \? "assertive" : "polite"\}/);
  assert.match(feedback, /aria-atomic="true"/);
  assert.match(feedback, /tabIndex=\{-1\}/);

  for (const source of forms) {
    assert.match(source, /<label htmlFor=/);
    assert.doesNotMatch(source, /<label[^>]+className="sr-only"/);
    assert.match(source, /<form[^>]+aria-busy=\{loading\}/);
    assert.match(source, /disabled=\{loading\}[\s\S]+aria-busy=\{loading\}/);
  }
});

test("authenticated shell supports keyboard navigation and reduced motion", () => {
  const layout = readRepositoryFile("components/layout/AppLayout.tsx");
  const sidebar = readRepositoryFile("components/dashboard/Sidebar.tsx");
  const navbar = readRepositoryFile("components/dashboard/Navbar.tsx");
  const styles = readRepositoryFile("app/globals.css");

  assert.match(layout, /href="#main-content"/);
  assert.match(layout, /<main id="main-content" tabIndex=\{-1\}/);
  assert.match(sidebar, /aria-label="Workspace sidebar"/);
  assert.match(sidebar, /aria-label="Primary workspace navigation"/);
  assert.match(navbar, /<nav[\s\S]+aria-label="Workspace shortcuts"/);
  assert.match(styles, /:focus-visible[\s\S]+outline: 2px solid #22d3ee/);
  assert.match(styles, /\.skip-link:focus-visible[\s\S]+translateY\(0\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /animation-duration: 0\.01ms !important/);
  assert.match(layout, /flex-col[\s\S]+lg:flex-row/);
  assert.match(layout, /p-4 sm:p-8/);
  assert.match(sidebar, /w-full[\s\S]+lg:w-64/);
  assert.match(sidebar, /grid-cols-2[\s\S]+sm:grid-cols-3[\s\S]+lg:block/);
  assert.match(navbar, /flex-wrap[\s\S]+sm:px-8/);
});
