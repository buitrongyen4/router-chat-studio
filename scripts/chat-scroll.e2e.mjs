import { chromium } from "@playwright/test";

const longMessages = Array.from({ length: 18 }, (_, index) => ({
  id: `scroll-${index}`,
  role: index % 2 === 0 ? "user" : "assistant",
  content: `${index % 2 === 0 ? "User" : "Assistant"} transmission ${index + 1}. ` + "This long line keeps the conversation viewport tall enough to exercise touch and pointer scrolling. ".repeat(7),
  createdAt: Date.now() - (18 - index) * 1000,
}));
const conversation = [{ id: "scroll-conversation", title: "Scrollable regression thread", model: "gpt-test", messages: longMessages, updatedAt: Date.now() }];
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(value => {
    window.localStorage.setItem("router-chat-studio:conversations", JSON.stringify(value));
  }, conversation);
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
  const stage = page.locator(".message-stage");
  await stage.waitFor({ state: "visible" });
  const before = await stage.evaluate(element => ({ scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }));
  if (before.scrollHeight <= before.clientHeight) throw new Error(`Conversation is not overflowing at ${viewport.width}px.`);
  await stage.evaluate(element => { element.scrollTop = 0; });
  await stage.hover();
  await page.mouse.wheel(0, 620);
  await page.waitForTimeout(80);
  const after = await stage.evaluate(element => element.scrollTop);
  if (after <= 0) {
    const details = await stage.evaluate(element => { const rect = element.getBoundingClientRect(); return { scrollTop: element.scrollTop, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight, rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right }, overflowY: getComputedStyle(element).overflowY, touchAction: getComputedStyle(element).touchAction }; });
    throw new Error(`Conversation did not scroll at ${viewport.width}px: ${JSON.stringify(details)}`);
  }
  await context.close();
}

await browser.close();
console.log("chat scroll regression passed at desktop and mobile widths");
