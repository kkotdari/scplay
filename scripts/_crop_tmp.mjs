import { chromium } from "playwright-core";
const [src, out, x, y, w, h] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const fs = await import("node:fs");
const d = fs.readFileSync(src).toString("base64");
await p.setContent(`<body style="margin:0"><img src="data:image/png;base64,${d}" style="position:absolute;left:-${x}px;top:-${y}px"></body>`);
await p.screenshot({ path: out }); await b.close();
