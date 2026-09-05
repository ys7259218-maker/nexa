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

  assert.match(feedback, /feedbackRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
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

test("auth forms cross-link between signup and login", () => {
  const login = readRepositoryFile("components/auth/LoginForm.tsx");
  const signup = readRepositoryFile("components/auth/SignupForm.tsx");

  assert.match(login, /href="\/signup"[\s\S]{0,200}Create an account/);
  assert.match(signup, /href="\/login"[\s\S]{0,200}Sign in/);
});

test("password fields let users reveal typed values instead of relying on memory", () => {
  const toggle = readRepositoryFile("components/auth/PasswordToggle.tsx");
  const login = readRepositoryFile("components/auth/LoginForm.tsx");
  const signup = readRepositoryFile("components/auth/SignupForm.tsx");
  const reset = readRepositoryFile("components/auth/ResetPasswordForm.tsx");

  assert.match(toggle, /aria-pressed=\{shown\}/);
  assert.match(toggle, /aria-label=\{shown \? "Hide password" : "Show password"\}/);
  assert.match(toggle, /type="button"/);

  assert.match(login, /type=\{showPassword \? "text" : "password"\}/);
  assert.match(login, /<PasswordToggle shown=\{showPassword\}/);

  assert.match(signup, /type=\{showPassword \? "text" : "password"\}/);
  assert.match(signup, /<PasswordToggle shown=\{showPassword\}/);

  assert.match(reset, /type=\{showPassword \? "text" : "password"\}/);
  assert.match(reset, /type=\{showConfirmation \? "text" : "password"\}/);
  assert.match(reset, /<PasswordToggle shown=\{showPassword\}/);
  assert.match(reset, /<PasswordToggle shown=\{showConfirmation\}/);
  assert.match(reset, /required/);
});

test("recovery forms each offer a way back to login", () => {
  const forgot = readRepositoryFile("components/auth/ForgotPasswordForm.tsx");
  const reset = readRepositoryFile("components/auth/ResetPasswordForm.tsx");

  for (const source of [forgot, reset]) {
    assert.match(source, /href="\/login"[\s\S]{0,300}Back to login/);
  }
});

test("signup form links the legal pages before creating an account", () => {
  const signup = readRepositoryFile("components/auth/SignupForm.tsx");

  assert.match(signup, /href="\/terms"[\s\S]{0,300}Terms of Service/);
  assert.match(signup, /href="\/privacy-policy"[\s\S]{0,300}Privacy Policy/);
  assert.match(signup, /By creating an account, you agree to the/);
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
  assert.match(source, /feedbackRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
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
  assert.match(source, /feedbackRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
});

test("voice, phone, and legacy knowledge settings avoid alerts and expose feedback", () => {
  const feedback = readRepositoryFile("components/ai/SettingsFeedback.tsx");
  const files = [
    "components/ai/VoiceSettings.tsx",
    "components/ai/PhoneSetup.tsx",
    "components/ai/KnowledgeBase.tsx",
  ].map(readRepositoryFile);

  assert.match(feedback, /feedbackRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
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
  assert.match(source, /value=\{message\}/);
  assert.match(source, /useState\(state\.customerMessage\)/);
  assert.match(source, /feedbackRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /role="alert"[\s\S]+aria-live="assertive"[\s\S]+aria-atomic="true"/);
  assert.match(source, /role="status"[^>]+aria-live="polite"[^>]+aria-atomic="true"/);
  assert.match(action, /customerMessage: validation\.value/);
  assert.match(source, /Simulation only — not sent or saved/);
  assert.match(source, /<textarea[\s\S]+name="recentMessages"/);
  assert.match(source, /Prior customer turns \(optional\)/);
  assert.match(source, /\{priorTurnCount\}\/\{SANDBOX_MEMORY_MAX_TURNS\} prior turns entered/);
  assert.match(action, /parseSandboxRecentMessages\(formData\.get\("recentMessages"\)\)/);
  assert.match(action, /recalledTurns: result\.ok \? result\.recalledTurns : undefined/);
  assert.match(source, /Recalled \{state\.recalledTurns\} prior customer/);
});

test("employee sandbox message field shows a live character counter", () => {
  const source = readRepositoryFile("components/ai/EmployeeTestSandbox.tsx");

  assert.match(source, /setMessage/);
  assert.match(source, /onChange=\{\(e\) => setMessage\(e\.target\.value\)\}/);
  assert.match(source, /\{message\.length\}\/\{SANDBOX_INPUT_MAX_LENGTH\.toLocaleString\(\)\} characters/);
  assert.match(source, /value=\{message\}/);
  assert.match(source, /maxLength=\{SANDBOX_INPUT_MAX_LENGTH\}/);
});

test("employee sandbox prior-turn field shows a live turn count instead of a character ceiling", () => {
  const source = readRepositoryFile("components/ai/EmployeeTestSandbox.tsx");

  assert.match(source, /priorTurns/);
  assert.match(source, /\{priorTurnCount\}\/\{SANDBOX_MEMORY_MAX_TURNS\} prior turns entered/);
  assert.match(source, /\.split\(\/\\r\?\\n\/\)/);
  assert.match(source, /filter\(\(line\) => line\.length > 0\)/);
  assert.match(source, /name="recentMessages"/);
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

test("dashboard analytics render contextual note text in a neutral color, not implying a trend", () => {
  const source = readRepositoryFile("components/dashboard/AnalyticsCards.tsx");

  assert.match(source, /<p className="text-zinc-400 text-sm mt-3 font-medium">/);
  assert.match(source, /\{item\.note\}/);
  assert.doesNotMatch(source, /text-green-400 text-sm/);
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
  assert.match(page, /AI draft\{inbox\.pendingDraftCounts\[item\.id\] === 1 \? "" : "s"\} pending/);
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

test("conversations inbox sidebar pluralizes pending AI draft badges", () => {
  const page = readRepositoryFile("app/conversations/page.tsx");

  assert.match(page, /AI draft\{inbox\.pendingDraftCounts\[item\.id\] === 1 \? "" : "s"\} pending/);
  assert.match(page, /pendingDraftCounts\[item\.id\] === 1 \? "" : "s"/);
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

test("new employee form surfaces a live required-details indicator", () => {
  const form = readRepositoryFile("components/ai/NewAIEmployeeForm.tsx");

  assert.match(form, /Required details complete/);
  assert.match(form, /name\.trim\(\)\.length > 0 && business\.trim\(\)\.length > 0/);
  assert.match(form, /Fill in the AI Employee name and business name/);
});

test("lifecycle controls explain why moving to Active is locked", () => {
  const card = readRepositoryFile("components/ai/LifecycleControls.tsx");

  assert.match(card, /Moving to Active is locked/);
  assert.match(card, /trusted server verification workflow/);
  assert.match(card, /includes\("Active"\) && !activationReady/);
});

test("detail page readiness banner lists remaining activation requirements", () => {
  const page = readRepositoryFile("app/ai-employees/[id]/page.tsx");

  assert.match(page, /unmetLabels/);
  assert.match(page, /unmetLabels\.join\(", "\)/);
  assert.match(page, /Remaining:/);
  assert.match(page, /!allReady && unmetLabels\.length > 0/);
});

test("conversation thread surfaces a danger banner for flagged safety states", () => {
  const page = readRepositoryFile("app/conversations/page.tsx");

  assert.match(page, /selectedSafety/);
  assert.match(page, /selectedSafety\.tone === "danger"/);
  assert.match(page, /Safety flagged\./);
  assert.match(page, /not eligible for AI drafting/);
});

test("version history shows language/voice and phone/country snapshot fields", () => {
  const card = readRepositoryFile("components/ai/EmployeeVersionHistory.tsx");

  assert.match(card, /Language & voice/);
  assert.match(card, /version\.snapshot\.language, version\.snapshot\.voice/);
  assert.match(card, /Phone & country/);
  assert.match(card, /version\.snapshot\.phone, version\.snapshot\.country/);
});

test("version history page surfaces the retained snapshot ceiling honestly", () => {
  const page = readRepositoryFile("app/ai-employees/[id]/versions/page.tsx");

  assert.match(page, /listEmployeeVersions\(supabase, id, 50\)/);
  assert.match(page, /Review up to 50 automatically retained settings snapshots/);
});

test("quick actions include a review AI Employees tile", () => {
  const actions = readRepositoryFile("components/dashboard/QuickActions.tsx");

  assert.match(actions, /Review AI Employees/);
  assert.match(actions, /href: "\/ai-employees"/);
});

test("recent activity surfaces a category badge for each activity type", () => {
  const activity = readRepositoryFile("components/dashboard/RecentActivity.tsx");

  assert.match(activity, /General/);
  assert.match(activity, /Call/);
  assert.match(activity, /Appointment/);
  assert.match(activity, /WhatsApp/);
  assert.match(activity, /activity\.category/);
  assert.match(activity, /rounded-xl border border-zinc-800 bg-zinc-900 p-4/);
  assert.match(activity, /No activity yet\. Your first logged change will appear here\./);
});

test("top navbar includes an AI Employees shortcut", () => {
  const nav = readRepositoryFile("components/dashboard/Navbar.tsx");

  assert.match(nav, /AI Employees/);
  assert.match(nav, /href="\/ai-employees"/);
});

test("navbar shortcuts announce the current page via aria-current", () => {
  const nav = readRepositoryFile("components/dashboard/Navbar.tsx");

  assert.match(nav, /usePathname/);
  assert.match(nav, /aria-current=\{isActive\("\/(dashboard|conversations|ai-employees|settings\/team)"\) \? "page" : undefined\}/g);
});

test("employee card maps lifecycle states to sensible badge colors", () => {
  const card = readRepositoryFile("components/ai/AIEmployeeCard.tsx");

  assert.match(card, /lifecycleBadgeVariant/);
  assert.match(card, /"Draft" \|\| lifecycleStatus === "Paused"/);
  assert.match(card, /"success"/);
  assert.match(card, /"warning"/);
  assert.match(card, /"info"/);
});

test("knowledge source review flags overdue reviews", () => {
  const source = readRepositoryFile("components/ai/KnowledgeSourceRegistry.tsx");

  assert.match(source, /review is now overdue/);
  assert.match(source, /new Date\(source\.review_due_at!\) < new Date\(\)/);
});

test("workspace roles expose human-readable descriptions and read-only guidance", () => {
  const workspace = readRepositoryFile("lib/workspaces.ts");
  const teamRole = readRepositoryFile("components/team/TeamMemberRole.tsx");

  assert.match(workspace, /workspaceRoleDescription/);
  assert.match(workspace, /"owner"/);
  assert.match(workspace, /"viewer"/);
  assert.match(teamRole, /workspaceRoleDescription\(selectedRole\)/);
  assert.match(teamRole, /Viewer access is read-only\./);
});

test("success rate card explains missing data instead of a cryptic dash", () => {
  const page = readRepositoryFile("components/dashboard/Dashboard.tsx");

  assert.match(page, /No recorded calls in the last 7 days/);
  assert.match(page, /successRatePercent === null/);
});

test("issue report form mirrors the description counter for the title", () => {
  const panel = readRepositoryFile("components/issues/IssueReportingPanel.tsx");

  assert.match(panel, /title\.length\}\/\{ISSUE_REPORT_TITLE_MAX_LENGTH\} title characters/);
  assert.match(panel, /description\.length\}\/\{ISSUE_REPORT_DESCRIPTION_MAX_LENGTH\} description characters/);
});

test("issue report list exposes a guarded self-service delete action", () => {
  const panel = readRepositoryFile("components/issues/IssueReportingPanel.tsx");

  assert.match(panel, /deleteIssueReport\(client, report\.id\)/);
  assert.match(panel, /window\.confirm\("Delete this issue report/);
  assert.match(panel, />Delete report</);
  assert.match(panel, /current\.filter\(\(item\) => item\.id !== result\.data!\.id\)/);
});

test("structured knowledge content field shows a live character counter", () => {
  const manager = readRepositoryFile("components/ai/StructuredKnowledgeManager.tsx");

  assert.match(manager, /value\.content\.length\}\/\{KNOWLEDGE_CONTENT_MAX_LENGTH\} content characters/);
});

test("inbox summary shows a clean empty state when there are no conversations or drafts", () => {
  const summary = readRepositoryFile("components/dashboard/InboxSummary.tsx");

  assert.match(summary, /openConversations === 0 && pendingDrafts === 0/);
  assert.match(summary, /No recorded conversations yet\. Inbound WhatsApp messages will appear here when delivered\./);
});

test("recent calls show status as the same pill style as upcoming appointments", () => {
  const calls = readRepositoryFile("components/dashboard/RecentCalls.tsx");
  const appointments = readRepositoryFile("components/dashboard/AppointmentsTable.tsx");

  assert.match(calls, /px-3 py-1 rounded-full text-sm font-medium/);
  assert.match(calls, /bg-green-500\/20 text-green-400/);
  assert.match(appointments, /bg-green-500\/20 text-green-400/);
});

test("byte-sized counts in knowledge source metadata use a singular label for one byte", () => {
  const sources = readRepositoryFile("components/ai/KnowledgeSourceRegistry.tsx");

  assert.match(sources, /value === 1 \? "byte" : "bytes"/);
});

test("interactive buttons outside forms declare an explicit button type", () => {
  const onboarding = readRepositoryFile("components/onboarding/OnboardingUI.tsx");
  const header = readRepositoryFile("components/dashboard/DashboardHeader.tsx");
  const dashboard = readRepositoryFile("components/dashboard/Dashboard.tsx");

  assert.match(onboarding, /<button[\s\S]*type="button"[\s\S]*onClick=\{onClick\}/);
  assert.match(header, /<button[\s\S]*type="button"[\s\S]*onClick=\{handleLogout\}/);
  assert.match(dashboard, /<button[\s\S]*type="button"[\s\S]*onClick=\{\(\) => router\.refresh\(\)\}/);
});

test("shared Button defaults to type button so clicks never submit forms by accident", () => {
  const button = readRepositoryFile("components/ui/Button.tsx");
  const settingsFiles = [
    "components/ai/GeneralSettings.tsx",
    "components/ai/VoiceSettings.tsx",
    "components/ai/KnowledgeBase.tsx",
    "components/ai/PhoneSetup.tsx",
    "components/ai/WhatsAppSetup.tsx",
  ];

  assert.match(button, /type = "button"/);
  assert.match(button, /type=\{type\}/);

  for (const file of settingsFiles) {
    assert.match(readRepositoryFile(file), /<Button type="submit"/);
  }
});

test("onboarding capability chips announce their pressed state", () => {
  const chips = readRepositoryFile("components/onboarding/OnboardingUI.tsx");

  assert.match(chips, /aria-pressed=\{selected\}/);
});

test("avatar tone is decorative next to the employee's name", () => {
  const avatar = readRepositoryFile("components/ui/Avatar.tsx");
  const card = readRepositoryFile("components/ai/AIEmployeeCard.tsx");

  assert.match(avatar, /aria-hidden="true"/);
  assert.match(card, /<Avatar name=\{employee\.name\} \/>/);
  assert.match(card, /<h2 className="text-xl font-semibold">\s*\{employee\.name\}/);
});

test("every navigation landmark carries a distinct accessible name", () => {
  const navbar = readRepositoryFile("components/dashboard/Navbar.tsx");
  const sidebar = readRepositoryFile("components/dashboard/Sidebar.tsx");
  const legal = readRepositoryFile("components/LegalPage.tsx");

  assert.match(navbar, /<nav[^>]+aria-label="Workspace shortcuts"/);
  assert.match(sidebar, /<nav[^>]+aria-label="Primary workspace navigation"/);
  assert.match(legal, /<nav[^>]+aria-label="Legal pages"/);
});

test("human-readable dates carry machine-readable time stamps", () => {
  const inbox = readRepositoryFile("app/conversations/page.tsx");
  const team = readRepositoryFile("app/settings/team/page.tsx");

  assert.match(inbox, /<time dateTime=\{item\.last_message_at\}/);
  assert.match(inbox, /<time dateTime=\{message\.created_at\}/);
  assert.match(inbox, /<time dateTime=\{turn\.created_at\}/);
  assert.match(team, /Joined <time dateTime=\{member\.created_at\}>/);
});

test("onboarding screens label every input", () => {
  const screens = readRepositoryFile("components/onboarding/OnboardingScreens.tsx");

  assert.match(
    screens,
    /<textarea[\s\S]*aria-label="Describe your business for the preview"/
  );
});

test("onboarding preview announces its position and refocuses each step", () => {
  const flow = readRepositoryFile("components/onboarding/OnboardingFlow.tsx");
  const ui = readRepositoryFile("components/onboarding/OnboardingUI.tsx");

  assert.match(flow, /<StepDots total=\{4\} current=\{step\} \/>/);
  assert.match(flow, /stepRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(flow, /tabIndex=\{-1\}/);
  assert.match(ui, /className="sr-only"[\s\S]+Step \{current \+ 1\} of \{total\}/);
  assert.match(ui, /aria-hidden="true"/);
});

test("busy labels use a single ellipsis character instead of three dots", () => {
  const files = [
    "components/auth/SignupForm.tsx",
    "components/auth/LoginForm.tsx",
    "components/ai/NewAIEmployeeForm.tsx",
    "components/ai/WhatsAppSetup.tsx",
    "components/ai/VoiceSettings.tsx",
    "components/ai/KnowledgeBase.tsx",
    "components/ai/GeneralSettings.tsx",
    "components/ai/PhoneSetup.tsx",
  ];
  const combined = files.map((file) => readRepositoryFile(file)).join("\n");

  assert.doesNotMatch(combined, /"[A-Za-z\s]+\.\.\."/);
  assert.match(combined, /Creating Account…/);
  assert.match(combined, /Logging In…/);
  assert.match(combined, /Assigning…/);
  assert.match(combined, /Linking…/);
  assert.match(combined, /Deleting…/);
});

test("not-found page matches the app theme, single heading, and offers a way home", () => {
  const notFound = readRepositoryFile("app/not-found.tsx");

  assert.match(notFound, /export const metadata: Metadata = \{[\s\S]*?title: "Page Not Found \| Nexa AI"/);
  assert.match(notFound, /className="flex min-h-screen/);
  assert.doesNotMatch(notFound, /<h2|<h3/);
  assert.match(notFound, /<Link[\s\S]*?href="\/"[\s\S]*?Back to Nexa/);
});

test("workspace sidebar brand stays out of the heading hierarchy", () => {
  const sidebar = readRepositoryFile("components/dashboard/Sidebar.tsx");

  assert.doesNotMatch(sidebar, /<h1/);
  assert.match(sidebar, /Nexa\s*<\/p>/);
  assert.doesNotMatch(sidebar, /<h1[^/]*Nexa/);
});

test("every loading shell declares an accessible busy region", () => {
  const shells: Array<[string, string]> = [
    ["app/settings/issues/loading.tsx", "loading issue reporting"],
    ["app/settings/team/loading.tsx", "loading team settings"],
    ["app/conversations/loading.tsx", "loading conversations"],
    ["app/dashboard/loading.tsx", "loading dashboard"],
    ["app/ai-employees/loading.tsx", "loading AI employees"],
    ["app/ai-employees/[id]/loading.tsx", "loading AI Employee"],
    ["app/ai-employees/[id]/knowledge/loading.tsx", "loading structured knowledge"],
    ["app/ai-employees/[id]/knowledge/sources/loading.tsx", "loading knowledge sources"],
    ["app/ai-employees/[id]/test/loading.tsx", "loading safe AI Employee simulation"],
    ["app/ai-employees/[id]/versions/loading.tsx", "loading AI Employee version history"],
  ];

  for (const [file, label] of shells) {
    const source = readRepositoryFile(file);
    assert.match(source, /aria-busy="true"/);
    assert.match(source, new RegExp(`aria-label="${label}"`, "i"));
  }
});

test("every loading shell keeps the authenticated chrome", () => {
  const shells = [
    "app/settings/issues/loading.tsx",
    "app/settings/team/loading.tsx",
    "app/conversations/loading.tsx",
    "app/dashboard/loading.tsx",
    "app/ai-employees/loading.tsx",
    "app/ai-employees/[id]/loading.tsx",
    "app/ai-employees/[id]/knowledge/loading.tsx",
    "app/ai-employees/[id]/knowledge/sources/loading.tsx",
    "app/ai-employees/[id]/test/loading.tsx",
    "app/ai-employees/[id]/versions/loading.tsx",
  ];

  for (const file of shells) {
    assert.match(readRepositoryFile(file), /import AppLayout/);
    assert.match(readRepositoryFile(file), /<AppLayout>/);
  }
});

test("primary pages expose a page-specific Nexa AI metadata title", () => {
  const pages: Array<[string, string]> = [
    ["app/page.tsx", "Welcome"],
    ["app/dashboard/page.tsx", "Dashboard"],
    ["app/ai-employees/page.tsx", "AI Employees"],
    ["app/ai-employees/[id]/page.tsx", "AI Employee"],
    ["app/ai-employees/[id]/knowledge/page.tsx", "Knowledge"],
    ["app/ai-employees/[id]/knowledge/sources/page.tsx", "Knowledge Sources"],
    ["app/ai-employees/[id]/test/page.tsx", "Test AI Employee"],
    ["app/ai-employees/[id]/versions/page.tsx", "Version History"],
    ["app/dashboard/ai-employees/new/page.tsx", "New AI Employee"],
    ["app/conversations/page.tsx", "Conversations"],
    ["app/settings/issues/page.tsx", "Issue Reporting"],
    ["app/settings/team/page.tsx", "Team Settings"],
    ["app/login/page.tsx", "Login"],
    ["app/signup/page.tsx", "Sign Up"],
    ["app/forgot-password/page.tsx", "Forgot Password"],
    ["app/reset-password/page.tsx", "Reset Password"],
  ];

  for (const [file, title] of pages) {
    assert.match(readRepositoryFile(file), new RegExp(`export const metadata: Metadata = \\{[\\s\\S]*?title: "${title} \\| Nexa AI"[\\s\\S]*?\\};`));
  }
});

test("root layout declares a dark theme-color for the browser chrome", () => {
  const layout = readRepositoryFile("app/layout.tsx");
  const metadataBlock = layout.match(/export const metadata: Metadata = \{[\s\S]*?\};/)?.[0];

  assert.ok(metadataBlock, "root layout exports a metadata object");
  assert.doesNotMatch(metadataBlock, /themeColor/i);
  assert.match(layout, /export const viewport: Viewport = \{/);
  assert.match(layout, /themeColor: "#09090b"/);
});

test("partitive count labels keep the plural because the noun agrees with the total", () => {
  const card = readRepositoryFile("components/ai/AIEmployeeCard.tsx");
  const detailPage = readRepositoryFile("app/ai-employees/[id]/page.tsx");
  const knowledge = readRepositoryFile("components/ai/StructuredKnowledgeManager.tsx");
  const sources = readRepositoryFile("components/ai/KnowledgeSourceRegistry.tsx");
  const sandbox = readRepositoryFile("components/ai/EmployeeTestSandbox.tsx");

  assert.match(card, /\{readinessCount\}\/\{readinessTotal\} requirements/);
  assert.match(detailPage, /requirements/);
  assert.match(knowledge, /of 50 retained entries shown/);
  assert.match(sources, /of 50 references shown/);
  assert.match(sandbox, /prior turns entered/);
});
