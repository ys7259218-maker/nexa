import {
  BROWSER_DRIVER_KINDS,
  BrowserDriverError,
  type BrowserDriver,
  type BrowserDriverDom,
  type BrowserDriverPage,
  type BrowserDriverScreenshot,
  type BrowserSideEffectingAction,
} from "./types.ts";

/**
 * Deterministic offline driver (draft scope C1b, matrix DG-01).
 *
 * It opens no socket, spawns no process, and downloads nothing. Every hop is
 * served from the in-memory `pages` map, so a test can assert exact behaviour
 * without a browser binary.
 */

export type MockPageDefinition = Readonly<{
  title?: string;
  redirectChain?: readonly string[];
  dom?: string;
  screenshot?: string;
}>;

export type MockDriverControl = {
  /** Awaited before a side-effecting action is applied. Tests use it to race a kill switch. */
  beforePerform: (() => Promise<void>) | null;
  /** Simulates a driver that cannot finish teardown. */
  teardownFails: boolean;
  /** Simulates a profile wipe that leaves a file behind. */
  wipeLeavesFile: boolean;
};

export type MockBrowserDriver = BrowserDriver & {
  readonly control: MockDriverControl;
  readonly calls: readonly string[];
  readonly launches: number;
  readonly installAttempts: number;
  readonly closed: boolean;
};

export type MockDriverOptions = Readonly<{
  pages?: Readonly<Record<string, MockPageDefinition>>;
}>;

const DEFAULT_DOM = "<html><body><p>mock page</p></body></html>";
const DEFAULT_SCREENSHOT = "mock-screenshot-bytes";

export function createMockDriver(options: MockDriverOptions = {}): MockBrowserDriver {
  const pages = options.pages ?? {};
  const calls: string[] = [];
  const control: MockDriverControl = {
    beforePerform: null,
    teardownFails: false,
    wipeLeavesFile: false,
  };
  let currentUrl = "";
  let currentPage: MockPageDefinition = {};
  let profileFiles = 1;
  let closed = false;

  function pageFor(url: string): MockPageDefinition {
    return pages[url] ?? {};
  }

  return {
    kind: BROWSER_DRIVER_KINDS[0],
    control,
    calls,
    get launches() {
      return 0;
    },
    get installAttempts() {
      return 0;
    },
    get closed() {
      return closed;
    },

    async open(url: string): Promise<BrowserDriverPage> {
      calls.push(`open:${url}`);
      currentUrl = url;
      currentPage = pageFor(url);
      return {
        url,
        title: currentPage.title ?? "Mock page",
        redirected: (currentPage.redirectChain?.length ?? 0) > 1,
        redirectChain: currentPage.redirectChain ?? [url],
      };
    },

    async screenshot(): Promise<BrowserDriverScreenshot> {
      calls.push("screenshot");
      return {
        bytes: new TextEncoder().encode(
          currentPage.screenshot ?? `${DEFAULT_SCREENSHOT}:${currentUrl}`,
        ),
        mediaType: "image/png",
      };
    },

    async domSnapshot(): Promise<BrowserDriverDom> {
      calls.push("dom");
      return {
        bytes: new TextEncoder().encode(currentPage.dom ?? DEFAULT_DOM),
        mediaType: "text/html",
      };
    },

    async perform(
      action: BrowserSideEffectingAction,
      target: Readonly<{ url: string; selector: string | null }>,
    ) {
      calls.push(`perform:${action}:${target.url}`);
      if (control.beforePerform !== null) {
        await control.beforePerform();
      }
      return { url: target.url, performed: true as const };
    },

    async close(): Promise<void> {
      calls.push("close");
      closed = true;
    },

    async wipeProfile(): Promise<void> {
      calls.push("wipe");
      profileFiles = control.wipeLeavesFile ? 1 : 0;
      if (control.teardownFails) {
        throw new BrowserDriverError("teardown_failed", "mock teardown failure");
      }
    },

    profileFileCount(): number {
      return profileFiles;
    },

    socketsOpened(): number {
      return 0;
    },
  };
}
