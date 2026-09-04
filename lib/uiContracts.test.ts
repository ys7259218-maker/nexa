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

  assert.match(quickActions, /title: "Review inbox"/);
  assert.match(quickActions, /href: "\/conversations"/);
  assert.match(quickActions, /pendingDrafts/);

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

test("AI Employee creation uses inline accessible feedback instead of browser alerts", () => {
  const source = readRepositoryFile("components/ai/NewAIEmployeeForm.tsx");

  assert.doesNotMatch(source, /\balert\(/);
  assert.match(source, /validateAIEmployeeInput/);
  assert.match(source, /<label htmlFor="employee-name"/);
  assert.match(source, /<label htmlFor="business-name"/);
  assert.match(source, /<label htmlFor="business-phone"/);
  assert.match(source, /<label htmlFor="employee-voice"/);
  assert.match(source, /<label htmlFor="employee-language"/);
  assert.match(source, /aria-busy=\{loading\}/);
  assert.match(source, /role=\{message\.type === "error" \? "alert" : "status"\}/);
  assert.match(source, /feedbackRef\.current\?\.focus\(\)/);
});

test("General Settings uses labeled bounded inputs and inline feedback", () => {
  const source = readRepositoryFile("components/ai/GeneralSettings.tsx");

  assert.doesNotMatch(source, /\balert\(/);
  assert.match(source, /validateAIEmployeeInput/);
  for (const id of [
    "general-name",
    "general-business",
    "general-department",
    "general-description",
    "general-greeting",
    "general-timezone",
    "general-hours",
  ]) {
    assert.match(source, new RegExp(`htmlFor="${id}"`));
    assert.match(source, new RegExp(`id="${id}"`));
  }
  assert.match(source, /aria-busy=\{saving \|\| deleting\}/);
  assert.match(source, /role=\{message\.type === "error" \? "alert" : "status"\}/);
  assert.match(source, /feedbackRef\.current\?\.focus\(\)/);
});

test("voice, phone, and legacy knowledge settings avoid alerts and expose feedback", () => {
  const feedback = readRepositoryFile("components/ai/SettingsFeedback.tsx");
  const files = [
    "components/ai/VoiceSettings.tsx",
    "components/ai/PhoneSetup.tsx",
    "components/ai/KnowledgeBase.tsx",
  ].map(readRepositoryFile);

  assert.match(feedback, /feedbackRef\.current\?\.focus\(\)/);
  assert.match(feedback, /aria-live=\{message\.type === "error" \? "assertive" : "polite"\}/);
  assert.match(feedback, /aria-atomic="true"/);

  for (const source of files) {
    assert.doesNotMatch(source, /\balert\(/);
    assert.match(source, /<form[^>]+aria-busy=\{saving\}/);
    assert.match(source, /<label htmlFor=/);
    assert.match(source, /<SettingsFeedback/);
    assert.match(source, /aria-busy=\{saving\}/);
  }

  assert.match(files[2], /Metadata only: Nexa does not crawl, upload, index, or retrieve/);
  assert.match(files[2], /saved as metadata only/);
});

test("WhatsApp Setup uses bounded labeled inputs and focused inline feedback", () => {
  const source = readRepositoryFile("components/ai/WhatsAppSetup.tsx");

  assert.doesNotMatch(source, /\balert\(/);
  assert.match(source, /<form[^>]+aria-busy=\{saving\}/);
  assert.match(source, /htmlFor="whatsapp-phone-number-id"/);
  assert.match(source, /htmlFor="whatsapp-display-name"/);
  assert.match(source, /maxLength=\{200\}/);
  assert.match(source, /<SettingsFeedback id="whatsapp-settings-feedback"/);
  assert.match(source, /aria-busy=\{assigningChannelId === channel\.id\}/);
  assert.match(source, /production outbound sending stays disabled/);
  assert.match(source, /aiProviderStatusRow\(aiProviderStatus\)\.ok/);
  assert.match(source, /AI provider: safe mock \(default\)/);
  assert.match(source, /AI provider: OpenAI active/);
});

test("Knowledge Source Registry exposes associated controls and focused feedback", () => {
  const source = readRepositoryFile("components/ai/KnowledgeSourceRegistry.tsx");

  assert.match(source, /<form[^>]+aria-busy=\{busy\}/);
  assert.match(source, /htmlFor="knowledge-source-kind"/);
  assert.match(source, /htmlFor="knowledge-source-label"/);
  assert.match(source, /htmlFor="knowledge-source-url"/);
  assert.match(source, /htmlFor="knowledge-source-file-name"/);
  assert.match(source, /htmlFor="knowledge-source-file-type"/);
  assert.match(source, /htmlFor="knowledge-source-file-size"/);
  assert.match(source, /<SettingsFeedback id="knowledge-source-feedback"/);
  assert.match(source, /aria-busy=\{busy\}/);
  assert.match(source, /No content was uploaded or processed/);
  assert.match(source, /not uploaded, crawled, parsed, embedded, or used by AI/);
});

test("Structured Knowledge uses associated bounded fields and focused mutation feedback", () => {
  const source = readRepositoryFile("components/ai/StructuredKnowledgeManager.tsx");

  assert.ok(source.includes('htmlFor={`${idPrefix}-kind`}'));
  assert.ok(source.includes('htmlFor={`${idPrefix}-title`}'));
  assert.ok(source.includes('htmlFor={`${idPrefix}-question`}'));
  assert.ok(source.includes('htmlFor={`${idPrefix}-content`}'));
  assert.ok(source.includes('htmlFor={`${idPrefix}-verified`}'));
  assert.match(source, /maxLength=\{KNOWLEDGE_TITLE_MAX_LENGTH\}/);
  assert.match(source, /maxLength=\{KNOWLEDGE_QUESTION_MAX_LENGTH\}/);
  assert.match(source, /maxLength=\{KNOWLEDGE_CONTENT_MAX_LENGTH\}/);
  assert.match(source, /<form[^>]+aria-busy=\{busy\}/);
  assert.match(source, /<SettingsFeedback id="structured-knowledge-feedback"/);
  assert.match(source, /Knowledge entry deleted/);
  assert.match(source, /No file upload, crawling, embeddings, or hidden ingestion/);
});

test("Lifecycle controls expose pending state and focused safety feedback", () => {
  const source = readRepositoryFile("components/ai/LifecycleControls.tsx");

  assert.match(source, /aria-busy=\{saving\}/);
  assert.match(source, /<SettingsFeedback id="lifecycle-feedback"/);
  assert.match(source, /Higher-level workspace and channel safety gates still apply/);
  assert.match(source, /Automation remains paused for this employee/);
  assert.match(source, /validateLifecycleTransition/);
  assert.match(source, /transition_ai_employee_lifecycle/);
});

test("Workspace kill switch exposes focused fail-closed feedback and pending state", () => {
  const source = readRepositoryFile("components/dashboard/WorkspaceKillSwitch.tsx");

  assert.match(source, /aria-busy=\{saving\}/);
  assert.match(source, /<SettingsFeedback id="workspace-safety-feedback"/);
  assert.match(source, /canManageWorkspace\(state\.role\)/);
  assert.match(source, /Resume workspace automation\?/);
  assert.match(source, /AI drafts remain blocked/);
  assert.match(source, /Individual employee and channel safety gates still apply/);
  assert.match(source, /setWorkspaceAutomationPaused/);
});

test("Team role controls expose reversible selection and focused mutation feedback", () => {
  const source = readRepositoryFile("components/team/TeamMemberRole.tsx");

  assert.match(source, /aria-busy=\{saving\}/);
  assert.match(source, /htmlFor=\{`member-role-\$\{userId\}`\}/);
  assert.match(source, /aria-describedby=\{message \? `member-role-\$\{userId\}-feedback` : undefined\}/);
  assert.match(source, /setSelectedRole\(role\)/);
  assert.match(source, /<SettingsFeedback id=\{`member-role-\$\{userId\}-feedback`\}/);
  assert.match(source, /canManageWorkspace\(viewerRole\)/);
  assert.match(source, /Database role protections still apply/);
  assert.match(source, /updateTeamMemberRole/);
});

test("Conversation safety exposes focused fail-closed feedback and honest eligibility copy", () => {
  const source = readRepositoryFile("components/conversations/ConversationSafetyControl.tsx");

  assert.match(source, /aria-busy=\{saving\}/);
  assert.match(source, /<SettingsFeedback id="conversation-safety-feedback"/);
  assert.match(source, /canOperateWorkspace\(role\)/);
  assert.match(source, /Return this conversation to AI draft eligibility\?/);
  assert.match(source, /Inbound history may still be stored, but AI drafts remain blocked/);
  assert.match(source, /Workspace, employee, channel, and opt-out safety gates still apply/);
  assert.match(source, /setConversationHumanTakeover/);
});

test("Employee version restore exposes pending state and focused scope feedback", () => {
  const source = readRepositoryFile("components/ai/EmployeeVersionHistory.tsx");

  assert.match(source, /aria-busy=\{pending\}/);
  assert.match(source, /<SettingsFeedback id="version-restore-feedback"/);
  assert.match(source, /Restore this saved version\? Your current settings will remain in history/);
  assert.match(source, /Lifecycle, automation pause, channel assignment, and workspace safety gates were not changed/);
  assert.match(source, /restoreEmployeeVersionAction/);
  assert.match(source, /state\.restoredVersionId === version\.id/);
});

test("Employee sandbox exposes pending state, retained input, and focused results", () => {
  const source = readRepositoryFile("components/ai/EmployeeTestSandbox.tsx");
  const action = readRepositoryFile("app/ai-employees/[id]/test/actions.ts");

  assert.match(source, /const \[state, action, pending\] = useActionState/);
  assert.match(source, /<form[^>]+aria-busy=\{pending\}/);
  assert.match(source, /defaultValue=\{state\.customerMessage\}/);
  assert.match(source, /feedbackRef\.current\?\.focus\(\)/);
  assert.match(source, /role="alert"[\s\S]+aria-live="assertive"[\s\S]+aria-atomic="true"/);
  assert.match(source, /role="status"[^>]+aria-live="polite"[^>]+aria-atomic="true"/);
  assert.match(action, /customerMessage: validation\.value/);
  assert.match(source, /Simulation only — not sent or saved/);
  assert.match(source, /<textarea[\s\S]+name="recentMessages"/);
  assert.match(source, /Prior customer turns \(optional\)/);
  assert.match(action, /parseSandboxRecentMessages\(formData\.get\("recentMessages"\)\)/);
  assert.match(action, /recalledTurns: result\.ok \? result\.recalledTurns : undefined/);
  assert.match(source, /Recalled \{state\.recalledTurns\} prior customer/);
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

test("performance chart exposes an equivalent text summary and honest empty status", () => {
  const source = readRepositoryFile("components/dashboard/PerformanceChart.tsx");

  assert.match(source, /id="performance-overview-title"/);
  assert.match(source, /id="performance-overview-description"/);
  assert.match(source, /role="status"/);
  assert.match(source, /<figure[\s\S]+aria-labelledby="performance-overview-title"/);
  assert.match(source, /<div aria-hidden="true" className="h-full">/);
  assert.match(source, /<figcaption className="sr-only">/);
  assert.match(source, /point\.calls === 1 \? "call" : "calls"/);
  assert.match(source, /<AreaChart data=\{data\} accessibilityLayer=\{false\} tabIndex=\{-1\}>/);
});

test("dashboard analytics expose a named metrics list with semantic cards", () => {
  const source = readRepositoryFile("components/dashboard/AnalyticsCards.tsx");

  assert.match(source, /<ul[\s\S]+aria-label="Dashboard metrics"/);
  assert.match(source, /<motion\.li/);
  assert.match(source, /<h2 className="text-sm text-zinc-400">/);
  assert.match(source, /<p className="text-4xl font-bold mt-3">/);
  assert.match(source, /aria-hidden="true"/);
  assert.doesNotMatch(source, /<motion\.div/);
});

test("dashboard renders an honest inbox summary panel linked to the inbox", () => {
  const summarySource = readRepositoryFile("components/dashboard/InboxSummary.tsx");
  const dashboardSource = readRepositoryFile("components/dashboard/Dashboard.tsx");
  const dashboardModel = readRepositoryFile("lib/dashboard.ts");

  assert.match(summarySource, /pluralize\(openConversations, "open conversation"\)/);
  assert.match(summarySource, /pluralize\(pendingDrafts, "pending AI draft"\)/);
  assert.match(summarySource, /href="\/conversations"/);
  assert.match(dashboardSource, /<InboxSummary/);
  assert.match(dashboardSource, /openConversations=\{view\.openConversations\}/);
  assert.match(dashboardSource, /pendingDrafts=\{view\.pendingDrafts\}/);
  assert.match(dashboardModel, /openConversations: number/);
  assert.match(dashboardModel, /pendingDrafts: number/);
  assert.match(dashboardModel, /\.eq\("status", "draft_blocked"\)/);

  const quickActionsSource = readRepositoryFile("components/dashboard/QuickActions.tsx");
  assert.match(dashboardSource, /<QuickActions pendingDrafts=\{view\.pendingDrafts\} \/>/);
  assert.match(quickActionsSource, /title: "Review inbox"/);
  assert.match(quickActionsSource, /pendingDrafts > 0/);
  assert.match(quickActionsSource, /\{pendingDrafts\} pending/);
});

test("conversations inbox annotates AI drafts with their recalled memory", () => {
  const page = readRepositoryFile("app/conversations/page.tsx");

  assert.match(page, /countPriorInboundTurns\(inbox\.messages, index\)/);
  assert.match(page, /isAiDraft = message\.direction === "outbound" && message\.status === "draft_blocked"/);
  assert.match(page, /Drafted against \{recalledTurns\} prior customer \{recalledTurns === 1 \? "turn" : "turns"\}/);
  assert.match(page, /Not sent — outbound is disabled/);
  assert.match(page, /priorInboundTurnsBefore\(inbox\.messages, index\)/);
  assert.match(page, /Show the \{draftTurns\.length\} source \{draftTurns\.length === 1 \? "turn" : "turns"\} this draft was based on/);
  assert.match(page, /<details/);
  assert.match(page, /AI draft pending/);
  assert.match(page, /pendingDraftCounts\[item\.id\] > 0/);
  assert.match(page, /conversationInboundCount = inbox\.messages\.filter/);
  assert.match(page, /selectedPendingDrafts = inbox\.selectedConversation/);
  assert.match(page, /\{conversationInboundCount\} customer \{conversationInboundCount === 1 \? "turn" : "turns"\}/);
  assert.match(page, /\u0060 · \$\{selectedPendingDrafts\} AI draft\$\{selectedPendingDrafts === 1 \? "" : "s"\} pending\u0060/);
  assert.match(page, /explainMissingDraft\(\{/);
  assert.match(page, /missingDraftReasons/);
  assert.match(page, /Why no draft\?/);
  assert.match(page, /reason\.summary/);
});

test("conversations empty inbox shows an actionable path to channel setup", () => {
  const page = readRepositoryFile("app/conversations/page.tsx");

  assert.match(page, /No conversations yet/);
  assert.match(page, /Open AI Employees to set up a channel/);
  assert.match(page, /href="\/ai-employees"/);
  assert.match(page, /linked WhatsApp channel with a completed webhook setup/);
});

test("AI employee cards expose WhatsApp channel-linked readiness", () => {
  const listPage = readRepositoryFile("app/ai-employees/page.tsx");
  const list = readRepositoryFile("components/ai/AIEmployeeList.tsx");
  const card = readRepositoryFile("components/ai/AIEmployeeCard.tsx");

  assert.match(listPage, /listWhatsAppChannels/);
  assert.match(listPage, /channelLinkedById/);
  assert.match(listPage, /channel\.ai_employee_id/);
  assert.match(listPage, /readinessById/);
  assert.match(listPage, /buildActivationChecklist/);
  assert.match(
    listPage,
    /<AIEmployeeList\s+employees=\{employees\}\s+channelLinkedById=\{channelLinkedById\}\s+readinessById=\{readinessById\}\s+readinessTotal=\{readinessTotal\}\s*\/>/,
  );
  assert.match(list, /channelLinkedById\?:\s*Record<string, boolean>/);
  assert.match(list, /readinessById\?:\s*Record<string, number>/);
  assert.match(list, /readinessTotal\?:\s*number/);
  assert.match(list, /channelLinked=\{channelLinkedById\[employee\.id\] \?\? false\}/);
  assert.match(list, /readinessCount=\{readinessById\[employee\.id\] \?\? 0\}/);
  assert.match(card, /channelLinked: boolean/);
  assert.match(card, /readinessCount: number/);
  assert.match(card, /readinessTotal: number/);
  assert.match(card, /WhatsApp ready/);
  assert.match(card, /No channel linked/);
  assert.match(card, /\{channelLinked \? "success" : "warning"\}/);
  assert.match(card, /Activation readiness/);
  assert.match(card, /\{readinessCount\}\/\{readinessTotal\} requirements/);
});

test("AI employee detail page surfaces an activation readiness summary", () => {
  const detailPage = readRepositoryFile("app/ai-employees/[id]/page.tsx");

  assert.match(detailPage, /buildActivationChecklist/);
  assert.match(detailPage, /isActivationReady/);
  assert.match(detailPage, /let readyCount = 0/);
  assert.match(detailPage, /readyTotal = checks\.length/);
  assert.match(detailPage, /readyCount = checks\.filter\(\(check\) => check\.ready\)\.length/);
  assert.match(detailPage, /const channelLinked =/);
  assert.match(detailPage, /channels\.some\(\(channel\) => channel\.ai_employee_id === employee\?\.id\)/);
  assert.match(detailPage, /Activation readiness/);
  assert.match(detailPage, /\{readyCount\}/);
  assert.match(detailPage, /\{readyTotal\}/);
  assert.match(detailPage, /<DeployAI employee=\{employee\} channelLinked=\{channelLinked\}/);
});

test("audit trail renders a contextual detail per event", () => {
  const trail = readRepositoryFile("components/ai/AuditTrail.tsx");
  const events = readRepositoryFile("lib/auditEvents.ts");

  assert.match(trail, /auditEventDetail/);
  assert.match(trail, /\{auditEventDetail\(event\)\}/);
  assert.match(events, /export function auditEventDetail/);
});

test("conversation inbox sidebar surfaces per-conversation safety indicators", () => {
  const page = readRepositoryFile("app/conversations/page.tsx");
  const conversations = readRepositoryFile("lib/conversations.ts");

  assert.match(conversations, /export function conversationSafetyIndicator/);
  assert.match(page, /conversationSafetyIndicator/);
  assert.match(page, /customer_opted_out_at: item\.customer_opted_out_at/);
  assert.match(page, /automation_mode: item\.automation_mode/);
  assert.match(page, /human_takeover_at: item\.human_takeover_at/);
  assert.match(page, /ai_employee_id: item\.ai_employee_id/);
  assert.match(page, /\{safety\.label\}/);
});

test("knowledge base card surfaces a reference-completeness indicator", () => {
  const card = readRepositoryFile("components/ai/KnowledgeBase.tsx");
  const lib = readRepositoryFile("lib/aiEmployees.ts");

  assert.match(card, /knowledgeSourceCount/);
  assert.match(card, /KNOWLEDGE_FIELDS/);
  assert.match(card, /References saved/);
  assert.match(card, /\{filledCount\}\/\{sourceTotal\} filled/);
  assert.match(card, /KNOWLEDGE_FIELDS\.map/);
  assert.match(lib, /export function knowledgeSourceCount/);
  assert.match(lib, /export const KNOWLEDGE_FIELDS/);
});

test("general settings card surfaces an identity completeness meter", () => {
  const card = readRepositoryFile("components/ai/GeneralSettings.tsx");
  const lib = readRepositoryFile("lib/aiEmployees.ts");

  assert.match(card, /identityFieldCompleteness/);
  assert.match(card, /IDENTITY_FIELDS/);
  assert.match(card, /Identity fields/);
  assert.match(card, /\{identity\.filled\}\/\{identityTotal\} complete/);
  assert.match(card, /IDENTITY_FIELDS\.map/);
  assert.match(lib, /export function identityFieldCompleteness/);
  assert.match(lib, /export const IDENTITY_FIELDS/);
});

test("voice settings card surfaces a voice preferences completeness meter", () => {
  const card = readRepositoryFile("components/ai/VoiceSettings.tsx");
  const lib = readRepositoryFile("lib/aiEmployees.ts");

  assert.match(card, /voiceFieldCompleteness/);
  assert.match(card, /VOICE_FIELDS/);
  assert.match(card, /Voice preferences/);
  assert.match(card, /\{voiceFields\.filled\}\/\{voiceTotal\} complete/);
  assert.match(card, /VOICE_FIELDS\.map/);
  assert.match(lib, /export function voiceFieldCompleteness/);
  assert.match(lib, /export const VOICE_FIELDS/);
});

test("phone setup card surfaces a phone metadata completeness meter", () => {
  const card = readRepositoryFile("components/ai/PhoneSetup.tsx");
  const lib = readRepositoryFile("lib/aiEmployees.ts");

  assert.match(card, /phoneFieldCompleteness/);
  assert.match(card, /PHONE_FIELDS/);
  assert.match(card, /Phone metadata/);
  assert.match(card, /\{phoneFields\.filled\}\/\{phoneTotal\} complete/);
  assert.match(card, /PHONE_FIELDS\.map/);
  assert.match(lib, /export function phoneFieldCompleteness/);
  assert.match(lib, /export const PHONE_FIELDS/);
});
