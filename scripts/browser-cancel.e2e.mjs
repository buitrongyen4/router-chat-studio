import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
const context = await browser.newContext();
const page = await context.newPage();

await page.route("**/api/chat/stream", async route => {
  await new Promise(resolve => setTimeout(resolve, 4000));
  try {
    await route.fulfill({ status: 200, contentType: "text/event-stream", body: 'data: {"text":"late response"}\n\ndata: {"done":true}\n\n' });
  } catch {
    // The page is expected to abort this request before the delayed response arrives.
  }
});

await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Settings", exact: true }).click();
await page.getByPlaceholder("Paste a key for this session").fill("browser-test-key");
await page.getByRole("button", { name: "Save & connect" }).click();
await page.getByPlaceholder("Transmit a message…").fill("Start a cancellable transmission");
await page.getByRole("button", { name: "Send" }).click();
await page.locator(".send-button").click();
await page.waitForTimeout(250);

const assistantRows = await page.locator(".message-row.assistant").count();
if (assistantRows !== 0) throw new Error(`Expected no empty assistant placeholder after cancellation; found ${assistantRows}.`);

await browser.close();
console.log("browser cancellation flow passed");
