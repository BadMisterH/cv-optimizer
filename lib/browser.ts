import chromium from "@sparticuz/chromium-min";
import puppeteer from "puppeteer-core";
import type { Browser } from "puppeteer-core";

// Doit matcher la version exacte de @sparticuz/chromium-min installée
// (cf. package.json). À mettre à jour conjointement.
const REMOTE_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v148.0.0/chromium-v148.0.0-pack.tar";

// Chrome système pour le dev local — surchageable via PUPPETEER_EXECUTABLE_PATH
const LOCAL_CHROME_PATHS: Record<string, string | undefined> = {
  darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  linux: "/usr/bin/google-chrome",
  win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
};

export async function launchBrowser(): Promise<Browser> {
  const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (isServerless) {
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(REMOTE_PACK_URL),
      headless: true,
    });
  }

  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ?? LOCAL_CHROME_PATHS[process.platform];

  return puppeteer.launch({
    headless: true,
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}
