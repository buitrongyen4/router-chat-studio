import { chromium } from "@playwright/test";

const longMessages = Array.from({ length: 20 }, (_, index) => ({
  id: `touch-${index}`,
  role: index % 2 === 0 ? "user" : "assistant",
  content: `${index % 2 === 0 ? "User" : "Assistant"} transmission ${index + 1}. ` + "This content creates a real overflow surface for a touch swipe regression test. ".repeat(8),
  createdAt: Date.now() - (20 - index) * 1000,
}));
const conversation = [{ id: "touch-conversation", title: "Touch scroll regression", model: "gpt-test", messages: longMessages, updatedAt: Date.now() }];
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await context.addInitScript(value => {
  window.localStorage.setItem("router-chat-studio:conversations", JSON.stringify(value));
}, conversation);
const page = await context.newPage();
await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
const stage = page.locator(".message-stage");
await stage.waitFor({ state: "visible" });
const metrics = await stage.evaluate(element => ({ scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }));
if (metrics.scrollHeight <= metrics.clientHeight) throw new Error("The mobile conversation did not overflow.");
await stage.evaluate(element => { element.scrollTop = 0; });
const box = await stage.boundingBox();
if (!box) throw new Error("Could not locate the mobile conversation viewport.");
const cdp = await context.newCDPSession(page);
await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
const x = box.x + box.width / 2;
const startY = box.y + Math.min(box.height - 24, 230);
const endY = box.y + 24;
await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: startY, radiusX: 8, radiusY: 8, force: 1 }] });
for (const offset of [0.3, 0.6, 1]) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: startY + (endY - startY) * offset, radiusX: 8, radiusY: 8, force: 1 }] });
}
await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
await page.waitForTimeout(120);
const scrollTop = await stage.evaluate(element => element.scrollTop);
if (scrollTop <= 0) throw new Error(`A real touch drag did not scroll the conversation: ${scrollTop}`);
await context.close();
await browser.close();
console.log("mobile touch scroll regression passed");
