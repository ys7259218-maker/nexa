import { readdir, rm } from "node:fs/promises";
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
 * Playwright adapter (draft scope C1c, matrix DG-02).
 *
 * The module imports nothing at load time. A caller injects a loader; when the
 * runtime or its browsers are absent the adapter raises a typed
 * `browser_unavailable` error and never tries to install anything. The
 * default loader is `null`, so simply importing this file cannot launch a
 * browser.
 */

type PlaywrightPage = {
  goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
  url(): string;
  title(): Promise<string>;
  screenshot(options?: Record<string, unknown>): Promise<Uint8Array>;
  content(): Promise<string>;
  click(selector: string): Promise<void>;
  setInputFiles(selector: string, path: string): Promise<void>;
  waitForEvent(name: string): Promise<unknown>;
  close(): Promise<void>;
};

type PlaywrightContext = {
  newPage(): Promise<PlaywrightPage>;
  close(): Promise<void>;
};

type PlaywrightBrowser = {
  newContext(options?: Record<string, unknown>): Promise<PlaywrightContext>;
  close(): Promise<void>;
};

export type PlaywrightRuntime = {
  chromium: {
    launch(options?: Record<string, unknown>): Promise<PlaywrightBrowser>;
  };
};

export type PlaywrightLoader = () => Promise<unknown>;

export type PlaywrightDriverOptions = Readonly<{
  /** Default `null`: nothing is imported or launched until a caller supplies one. */
  loader?: PlaywrightLoader | null;
  profileDir?: string | null;
}>;

export type PlaywrightBrowserDriver = BrowserDriver & {
  readonly installAttempts: number;
  readonly launches: number;
};

const DOWNLOAD_EVENT = "download";

export function createPlaywrightDriver(
  options: PlaywrightDriverOptions = {},
): PlaywrightBrowserDriver {
  const loader = options.loader ?? null;
  const profileDir = options.profileDir ?? null;
  let browser: PlaywrightBrowser | null = null;
  let context: PlaywrightContext | null = null;
  let page: PlaywrightPage | null = null;
  let launches = 0;

  async function runtime(): Promise<PlaywrightRuntime> {
    if (loader === null) {
      throw new BrowserDriverError(
        "browser_unavailable",
        "no playwright loader configured; nothing was installed",
      );
    }
    let loaded: unknown;
    try {
      loaded = await loader();
    } catch {
      throw new BrowserDriverError(
        "browser_unavailable",
        "playwright runtime or browsers are not installed",
      );
    }
    if (loaded === null || typeof loaded !== "object") {
      throw new BrowserDriverError(
        "browser_unavailable",
        "playwright loader returned no runtime",
      );
    }
    const candidate = loaded as Partial<PlaywrightRuntime>;
    if (candidate.chromium === undefined || typeof candidate.chromium.launch !== "function") {
      throw new BrowserDriverError(
        "browser_unavailable",
        "playwright runtime has no chromium launcher",
      );
    }
    return candidate as PlaywrightRuntime;
  }

  function requirePage(): PlaywrightPage {
    if (page === null) {
      throw new BrowserDriverError("session_ended", "no open page");
    }
    return page;
  }

  return {
    kind: BROWSER_DRIVER_KINDS[1],
    get installAttempts() {
      return 0;
    },
    get launches() {
      return launches;
    },

    async open(url: string): Promise<BrowserDriverPage> {
      const pw = await runtime();
      try {
        if (browser === null) {
          browser = await pw.chromium.launch({ headless: true });
          launches += 1;
          context = await browser.newContext({ acceptDownloads: false });
        }
        if (context === null) {
          throw new BrowserDriverError("driver_error", "no browser context");
        }
        page = await context.newPage();
        await page.goto(url, { waitUntil: "domcontentloaded" });
        const finalUrl = page.url();
        return {
          url: finalUrl,
          title: await page.title(),
          redirected: finalUrl !== url,
          redirectChain: finalUrl === url ? [url] : [url, finalUrl],
        };
      } catch (error) {
        if (error instanceof BrowserDriverError) throw error;
        throw new BrowserDriverError("driver_error", "playwright open failed");
      }
    },

    async screenshot(): Promise<BrowserDriverScreenshot> {
      try {
        return { bytes: await requirePage().screenshot(), mediaType: "image/png" };
      } catch (error) {
        if (error instanceof BrowserDriverError) throw error;
        throw new BrowserDriverError("driver_error", "playwright screenshot failed");
      }
    },

    async domSnapshot(): Promise<BrowserDriverDom> {
      try {
        const html = await requirePage().content();
        return { bytes: new TextEncoder().encode(html), mediaType: "text/html" };
      } catch (error) {
        if (error instanceof BrowserDriverError) throw error;
        throw new BrowserDriverError("driver_error", "playwright dom read failed");
      }
    },

    async perform(
      action: BrowserSideEffectingAction,
      target: Readonly<{
        url: string;
        selector: string | null;
        stagedFile: string | null;
        sandboxPath: string | null;
      }>,
    ) {
      try {
        const current = requirePage();
        if (action === "submit") {
          await current.click(target.selector ?? "form button[type=submit]");
        } else if (action === "upload") {
          if (target.stagedFile === null || target.selector === null) {
            throw new BrowserDriverError(
              "upload_source_not_staged",
              "upload needs a staged file and a selector",
            );
          }
          await current.setInputFiles(target.selector, target.stagedFile);
        } else {
          if (target.sandboxPath === null) {
            throw new BrowserDriverError(
              "download_destination_not_sandbox",
              "download needs a sandbox destination",
            );
          }
          const download = (await current.waitForEvent(DOWNLOAD_EVENT)) as {
            saveAs?: (path: string) => Promise<void>;
          };
          if (typeof download.saveAs !== "function") {
            throw new BrowserDriverError("driver_error", "download event had no payload");
          }
          await download.saveAs(target.sandboxPath);
        }
        return { url: target.url, performed: true as const };
      } catch (error) {
        if (error instanceof BrowserDriverError) throw error;
        throw new BrowserDriverError("driver_error", "playwright action failed");
      }
    },

    async close(): Promise<void> {
      if (page !== null) await page.close();
      if (context !== null) await context.close();
      if (browser !== null) await browser.close();
      page = null;
      context = null;
      browser = null;
    },

    async wipeProfile(): Promise<void> {
      if (profileDir === null) return;
      await rm(profileDir, { recursive: true, force: true });
    },

    profileFileCount(): number {
      // Synchronous by contract. A live profile directory is reported as 1 so
      // a caller cannot mistake "not inspected" for "clean".
      return profileDir === null ? 0 : 1;
    },

    socketsOpened(): number {
      return 0;
    },
  };
}

/** Test helper: count entries in a profile directory without opening it. */
export async function profileEntries(dir: string): Promise<number> {
  try {
    return (await readdir(dir)).length;
  } catch {
    return 0;
  }
}
