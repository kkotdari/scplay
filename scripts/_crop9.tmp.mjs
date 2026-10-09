// node scripts/_crop9.tmp.mjs in.png out.png x y w h [scale]
import { chromium } from "playwright-core";
import { readFileSync, existsSync } from "node:fs";
const [inp, out, x, y, w, h, sc = "4"] = process.argv.slice(2);
const b64 = readFileSync(inp).toString("base64");
const S = Number(sc), W = Math.ceil(Number(w) * S), H = Math.ceil(Number(h) * S);
const exe = ["/opt/pw-browsers/chromium"].find((p) => existsSync(p));
const opt = exe ? { executablePath: exe, args: ["--no-proxy-server"] } : { args: ["--no-proxy-server"] };
const br = await chromium.launch(opt).catch(() => chromium.launch({ ...opt, headless: false, args: [...opt.args, "--headless=new", "--no-sandbox"] }));
const pg = await br.newPage({ viewport: { width: W, height: H } });
await pg.setContent(`<body style="margin:0;background:#f0f"><canvas id=c width=${W} height=${H}></canvas><script>
const im = new Image(); im.onload = () => { const c = document.getElementById('c').getContext('2d'); c.imageSmoothingEnabled = false;
c.drawImage(im, ${x}, ${y}, ${w}, ${h}, 0, 0, ${W}, ${H}); document.title = 'ok'; }; im.src = 'data:image/png;base64,${b64}';</script>`);
await pg.waitForFunction(() => document.title === "ok");
await pg.screenshot({ path: out, clip: { x: 0, y: 0, width: W, height: H } });
await br.close();
