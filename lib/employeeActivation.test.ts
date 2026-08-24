import assert from "node:assert/strict";
import test from "node:test";
import { buildActivationChecklist, isActivationReady } from "./employeeActivation.ts";
import type { AIEmployee } from "./aiEmployees.ts";

const employee = { name: "Ava", business_name: "Nexa", department: "Support", business_description: "Support", greeting_message: "Hello", timezone: "Asia/Kolkata", working_hours: "9-5", language: "English", voice: "Female", knowledge_notes: "Reviewed", knowledge_website: "", knowledge_faq_document: "", knowledge_pdf_url: "" } as AIEmployee;

test("outbound blocker prevents activation despite complete configuration", () => {
  const checks = buildActivationChecklist(employee, { linked: true, webhookConfigured: true, inboundReady: true, outboundEnabled: false });
  assert.equal(checks.filter((check) => check.ready).length, 6);
  assert.equal(isActivationReady(checks), false);
});

test("activation requires every evidence-backed check", () => {
  const channel = { linked: true, webhookConfigured: true, inboundReady: true, outboundEnabled: true };
  assert.equal(isActivationReady(buildActivationChecklist(employee, channel)), true);
  assert.equal(isActivationReady(buildActivationChecklist({ ...employee, knowledge_notes: "" }, channel)), false);
});
