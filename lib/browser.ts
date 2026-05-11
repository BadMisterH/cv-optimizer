import fs from "fs";
import chromium from "@sparticuz/chromium-min";
import puppeteerCore from "puppeteer-core";
import type { Browser } from "puppeteer-core";

// Doit matcher la version exacte de @sparticuz/chromium-min installée
// (cf. package.json). À mettre à jour conjointement.
const REMOTE_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v148.0.0/chromium-v148.0.0-pack.x64.tar";

const LOCAL_CHROME_PATHS: Record<string, string | undefined> = {
  darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  linux: "/usr/bin/google-chrome",
  win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
};

const LOCAL_ARGS = ["--no-sandbox", "--disable-setuid-sandbox"];

export async function launchBrowser(): Promise<Browser> {
  const isServerless =
    !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (isServerless) {
    return puppeteerCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(REMOTE_PACK_URL),
      headless: true,
    });
  }

  try {
    const fullPuppeteer = await import("puppeteer");
    return await fullPuppeteer.default.launch({
      headless: true,
      args: LOCAL_ARGS,
    });
  } catch (err) {
    console.warn("[browser] full puppeteer unavailable, trying system Chrome", err);
  }

  const localExecutablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ?? LOCAL_CHROME_PATHS[process.platform];

  if (localExecutablePath && fs.existsSync(localExecutablePath)) {
    return puppeteerCore.launch({
      headless: true,
      executablePath: localExecutablePath,
      args: LOCAL_ARGS,
    });
  }

  throw new Error(
    "Aucun Chromium disponible en local. Installe `puppeteer` (npm i -D puppeteer) ou définis PUPPETEER_EXECUTABLE_PATH."
  );
}
