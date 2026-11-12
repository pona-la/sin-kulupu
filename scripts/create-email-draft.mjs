// Create a Gmail draft of a rendered newsletter issue. Sending is manual.
// Usage: npm run email -- content/2026/p.md [--dry-run]
// --dry-run writes dist/email.html without contacting Google.
// Put EMAIL_WEBAPP_URL, EMAIL_TOKEN, EMAIL_TO, and optional EMAIL_BCC in
// scripts/.env or the process environment.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import juice from "juice";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const filepath = args.find((arg) => !arg.startsWith("--"));
const file = filepath ?? fs
  .readdirSync("content", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((year) =>
    fs
      .readdirSync(path.join("content", year.name), { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.mdx?$/.test(entry.name))
      .map((entry) => path.join("content", year.name, entry.name)),
  )
  .sort()
  .at(-1);
if (!file) {
  console.error("No newsletter issue found in content/<year>/");
  process.exit(1);
}

// Same id as the glob loader in src/content.config.ts.
const id = path
  .relative("content", file)
  .replace(/\.mdx?$/, "")
  .replaceAll(path.sep, "/");

const { hostname } = JSON.parse(fs.readFileSync("src/config.json", "utf-8"));
const site = `https://${hostname}`;
const url = `${site}/${id}/`;

execFileSync("npx", ["astro", "build"], { stdio: "inherit" });

const page = fs.readFileSync(`dist/${id}/index.html`, "utf-8");
const extract = (re) => {
  const match = page.match(re);
  if (!match) throw new Error(`${re} not found in dist/${id}/index.html`);
  return match[1].trim();
};
const title = extract(/<h1[^>]*>([\s\S]*?)<\/h1>/);
const article = extract(/<article[^>]*>([\s\S]*)<\/article>/).replace(
  /(href|src)="\//g,
  `$1="${site}/`,
);

const css = fs.readFileSync("scripts/email/email.css", "utf-8");
const html = juice.inlineContent(
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
<div class="container">
${article}
<p class="footer">Read this issue on the web: <a href="${url}">${url}</a></p>
</div>
</body>
</html>
`,
  css,
).replace(/[\u{10000}-\u{10ffff}]/gu, (character) => `&#${character.codePointAt(0)};`);

// Keep the whole issue readable in text-only clients.
const text = `${fs
  .readFileSync(file, "utf-8")
  .replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "")
  .trim()}\n\nRead this issue on the web: ${url}\n`;

const subject = title.replace(/<[^>]*>/g, "");
// GmailApp mangled the non-BMP emoji in the subject. Pass that character as an
// ASCII RFC 2047 encoded word while leaving the rest of the subject readable.
const gmailSubject = subject.replace(/[\u{10000}-\u{10ffff}]+/gu, (characters) =>
  `=?UTF-8?B?${Buffer.from(characters, "utf-8").toString("base64")}?=`,
);

// Apps Script's POST decoding damaged the emoji in the previous request.
// Escaping UTF-16 code units makes the JSON ASCII while JSON.parse restores
// the exact Unicode strings before GmailApp.createDraft receives them.
function asciiJson(value) {
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, (character) =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

if (fs.existsSync("scripts/.env")) process.loadEnvFile("scripts/.env");
const { EMAIL_WEBAPP_URL, EMAIL_TOKEN, EMAIL_TO, EMAIL_BCC } = process.env;
if (!EMAIL_TO || (!dryRun && (!EMAIL_WEBAPP_URL || !EMAIL_TOKEN))) {
  console.error("EMAIL_TO, EMAIL_WEBAPP_URL, and EMAIL_TOKEN must be set (the latter two are optional for --dry-run)");
  process.exit(1);
}

if (dryRun) {
  fs.writeFileSync("dist/email.html", html);
  console.log("Wrote dist/email.html; no draft created");
  process.exit(0);
}

const response = await fetch(EMAIL_WEBAPP_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: asciiJson({
    token: EMAIL_TOKEN,
    to: EMAIL_TO,
    bcc: EMAIL_BCC,
    subject: gmailSubject,
    text,
    html,
  }),
});
const result = await response.json().catch(() => ({ error: response.statusText }));
if (typeof result.error === "string" && result.error.startsWith("sendAt is not in the future:")) {
  console.error("The configured Apps Script /exec URL still runs the old scheduled-email deployment. Deploy a new version of the existing web app.");
  process.exit(1);
}
if (!response.ok || result.error || !result.draftId) {
  console.error(`Draft creation failed: ${result.error ?? `no draft ID returned (HTTP ${response.status})`}`);
  process.exit(1);
}
console.log(`Created draft for "${subject}" (ID: ${result.draftId}); send it manually in Gmail`);
