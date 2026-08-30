import { chromium } from "@playwright/test";

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map(index => Number.parseInt(value.slice(index, index + 2), 16) / 255);
}

function luminance(hex) {
  return hexToRgb(hex).map(channel => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4).reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrastRatio(foreground, background) {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });

const focusableCount = await page.locator("button, input, textarea, select").count();
if (focusableCount < 10) throw new Error("Expected the primary controls to be keyboard reachable.");
let focusVisibleFound = false;
for (let index = 0; index < Math.min(focusableCount, 14); index += 1) {
  await page.keyboard.press("Tab");
  const state = await page.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement)) return { focusVisible: false };
    const styles = getComputedStyle(element);
    return { focusVisible: element.matches(":focus-visible") && styles.outlineStyle !== "none" && styles.outlineWidth !== "0px" };
  });
  if (state.focusVisible) focusVisibleFound = true;
}
if (!focusVisibleFound) throw new Error("No visible focus ring was found while tabbing through the interface.");

await page.getByRole("button", { name: "Settings", exact: true }).click();
const dialog = page.getByRole("dialog");
if (await dialog.getAttribute("aria-modal") !== "true") throw new Error("Settings dialog is missing aria-modal=true.");
const labelsAreAssociated = await dialog.locator("label").evaluateAll(labels => labels.length > 0 && labels.every(label => Boolean(label.control)));
if (!labelsAreAssociated) throw new Error("Every settings label must own or associate a form control.");
await page.keyboard.press("Escape");
if (await page.getByRole("dialog").count() !== 0) throw new Error("Escape should close the settings dialog.");

const checkedPairs = {
  primaryButton: contrastRatio("#351710", "#e2b747"),
  bodyText: contrastRatio("#f6e8c7", "#4e241b"),
  mutedText: contrastRatio("#c39b81", "#4e241b"),
};
if (checkedPairs.primaryButton < 4.5 || checkedPairs.bodyText < 4.5 || checkedPairs.mutedText < 4.5) throw new Error(`Contrast check failed: ${JSON.stringify(checkedPairs)}`);

await browser.close();
console.log(JSON.stringify({ focusableCount, focusVisibleFound, labelsAreAssociated, checkedPairs }));
