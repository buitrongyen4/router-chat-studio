import { chromium } from "@playwright/test";

const initialMessages = Array.from({ length: 12 }, (_, index) => ({
  id: `stream-scroll-${index}`,
  role: index % 2 === 0 ? "user" : "assistant",
  content: `${index % 2 === 0 ? "User" : "Assistant"} context ${index + 1}. ` + "This existing context keeps the message stage tall enough to verify streaming auto-scroll behavior. ".repeat(6),
  createdAt: Date.now() - (12 - index) * 1000,
}));
const conversation = [{ id: "stream-scroll-conversation", title: "Streaming scroll regression", model: "gpt-test", messages: initialMessages, updatedAt: Date.now() }];
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.addInitScript(value => window.localStorage.setItem("router-chat-studio:conversations", JSON.stringify(value)), conversation);
const page = await context.newPage();
await page.route("**/api/chat/stream", async route => {
  await new Promise(resolve => setTimeout(resolve, 450));
  await route.fulfill({ status: 200, contentType: "text/event-stream", body: 'data: {"text":"A streamed response with enough detail to update the conversation viewport."}\n\ndata: {"done":true}\n\n' });
});

await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
await page.locator(".topbar-settings").click();
await page.getByPlaceholder("Paste a key for this session").fill("stream-scroll-test-key");
await page.getByRole("button", { name: "Save & connect" }).click();
const stage = page.locator(".message-stage");
const composer = page.getByPlaceholder("Transmit a message…");
const sendButton = page.locator(".send-button");

async function waitForResponse() {
  await page.locator(".streaming-label").waitFor({ state: "visible" });
  await page.locator(".streaming-label").waitFor({ state: "hidden", timeout: 3000 });
}

async function scrollMetrics() {
  return stage.evaluate(element => ({ scrollTop: element.scrollTop, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }));
}

await composer.fill("Keep the viewport pinned while this response streams");
await sendButton.click();
await waitForResponse();
let metrics = await scrollMetrics();
if (metrics.scrollHeight - metrics.clientHeight - metrics.scrollTop > 24) throw new Error(`Auto-scroll did not remain pinned: ${JSON.stringify(metrics)}`);

await composer.fill("Preserve my manual scroll position");
await sendButton.click();
await page.waitForTimeout(100);
await stage.evaluate(element => { element.scrollTop = 0; element.dispatchEvent(new Event("scroll", { bubbles: true })); });
await waitForResponse();
metrics = await scrollMetrics();
if (metrics.scrollTop > 48) throw new Error(`Manual upward scroll was not preserved: ${JSON.stringify(metrics)}`);

await stage.evaluate(element => { element.scrollTop = element.scrollHeight; element.dispatchEvent(new Event("scroll", { bubbles: true })); });
await composer.fill("Resume pinned scrolling after returning to the bottom");
await sendButton.click();
await waitForResponse();
metrics = await scrollMetrics();
if (metrics.scrollHeight - metrics.clientHeight - metrics.scrollTop > 24) throw new Error(`Auto-scroll did not resume at the bottom: ${JSON.stringify(metrics)}`);

await context.close();
await browser.close();
console.log("streaming scroll regression passed");
