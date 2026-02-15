import { Page } from "@playwright/test";

/**
 * Widget Integration Helper Functions
 * Handles iframe communication, postMessage, account switching
 */

/**
 * Wait for widget iframe to load
 */
export async function getWidgetFrame(page: Page) {
  return page.frameLocator('iframe[id="account-switcher-widget"]');
}

/**
 * Wait for WIDGET_READY message from iframe
 * Returns the message payload
 */
export async function waitForWidgetReady(page: Page, timeout = 5000) {
  const message = await page.evaluate(
    ({ timeoutMs }) => {
      return new Promise<{
        type: string;
        nonce: string;
        requestId: string;
      }>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("WIDGET_READY timeout")),
          timeoutMs
        );

        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === "WIDGET_READY") {
            clearTimeout(timer);
            window.removeEventListener("message", handleMessage);
            resolve(event.data);
          }
        };

        window.addEventListener("message", handleMessage);
      });
    },
    { timeoutMs: timeout }
  );

  return message;
}

/**
 * Send postMessage to widget iframe
 */
export async function sendWidgetMessage(
  page: Page,
  message: Record<string, unknown>
) {
  await page.evaluate(
    (msg) => {
      const iframe = document.querySelector(
        'iframe[id="account-switcher-widget"]'
      ) as HTMLIFrameElement;
      if (!iframe?.contentWindow) {
        throw new Error("Widget iframe not found");
      }
      iframe.contentWindow.postMessage(msg, "*");
    },
    message
  );
}

/**
 * Wait for specific widget response message
 */
export async function waitForWidgetMessage(
  page: Page,
  messageType: string,
  timeout = 5000
) {
  const message = await page.evaluate(
    ({ type, timeoutMs }) => {
      return new Promise<Record<string, unknown>>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`${type} timeout`)),
          timeoutMs
        );

        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === type) {
            clearTimeout(timer);
            window.removeEventListener("message", handleMessage);
            resolve(event.data);
          }
        };

        window.addEventListener("message", handleMessage);
      });
    },
    { type: messageType, timeoutMs: timeout }
  );

  return message;
}

/**
 * Click account switch button in widget
 */
export async function switchAccountInWidget(
  page: Page,
  accountIndex: number = 0
) {
    const widgetFrame = await getWidgetFrame(page);

    const buttons = widgetFrame.locator('button:has-text("Switch")');
    const count = await buttons.count();

    if (count <= accountIndex) {
    throw new Error(
        `Account ${accountIndex} not found. Found ${count} switch buttons`
    );
    }

    await buttons.nth(accountIndex).click();
}

/**
 * Get list of accounts displayed in widget
 */
export async function getAccountsInWidget(page: Page) {
  const widgetFrame = await getWidgetFrame(page);
  const accountElements = widgetFrame.locator("[data-account-id]");
  const count = await accountElements.count();

  const accounts = [];
  for (let i = 0; i < count; i++) {
    const element = accountElements.nth(i);
    const accountId = await element.getAttribute("data-account-id");
    const nameText = await element.locator("strong").textContent();
    const emailText = await element.locator("small").textContent();

    accounts.push({
      accountId,
      name: nameText?.trim(),
      email: emailText?.trim(),
    });
  }

  return accounts;
}

/**
 * Click logout button in widget (app-scoped or global)
 */
export async function logoutFromWidget(
  page: Page,
  scope: "app" | "global" = "app"
) {
  const widgetFrame = await getWidgetFrame(page);
  const buttonText = scope === "global" ? "Logout Everywhere" : "Logout";
  await widgetFrame.locator(`button:has-text("${buttonText}")`).click();
}
