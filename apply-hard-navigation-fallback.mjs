import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const targets = [
  path.join(root, "components", "AppHeader.tsx"),
  path.join(root, "components", "AuthNav.tsx"),
  path.join(root, "app", "tournaments", "[id]", "page.tsx"),
];

function makeNativeNavigation(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required navigation file was not found: ${filePath}`);
  }

  let source = fs.readFileSync(filePath, "utf8");
  const marker = 'data-cb-hard-navigation="true"';

  if (source.includes(marker) && !source.includes("<Link")) {
    console.log(`Already converted: ${path.relative(root, filePath)}`);
    return;
  }

  const backupPath = `${filePath}.before-0.9f7`;
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
  }

  source = source.replace(
    /^\s*import Link from ["']next\/link["'];\s*\r?\n?/m,
    "",
  );

  source = source.replace(
    /<Link\b/g,
    `<a ${marker}`,
  );
  source = source.replace(/<\/Link>/g, "</a>");

  if (source.includes("<Link") || source.includes("</Link>")) {
    throw new Error(
      `Some Next Link tags remain in ${filePath}. The file was not written.`,
    );
  }

  if (!source.includes(marker)) {
    throw new Error(
      `No navigation links were converted in ${filePath}. The file was not written.`,
    );
  }

  fs.writeFileSync(filePath, source, "utf8");
  console.log(`Native navigation enabled: ${path.relative(root, filePath)}`);
}

for (const target of targets) {
  makeNativeNavigation(target);
}

console.log("");
console.log("CueBracket 0.9F.7 hard-navigation fallback applied.");
console.log(
  "Header, account and tournament-page links now use normal browser navigation.",
);
