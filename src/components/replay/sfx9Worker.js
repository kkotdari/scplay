/* 효과음 굽기 일꾼(2026-10-22, 지적: "소리 추가 후 좀 버벅임") — 24종 × 갈래 2~3벌의 PCM 합성은 데스크톱에서도 한 종류 5~37ms(모두 ~260ms)라,
   메인에서 쉴 틈마다 구우면 폰에선 재생 중 긴 멈춤이 났다. 여기서 다 굽고 종류마다 PCM(Float32 · 22.05kHz 모노)을 넘긴다(transfer) — 메인은 AudioBuffer 에 옮겨 담기만 한다.
   (워커 → 메인) { kind, pcms: ArrayBuffer[] } 종류마다 한 번 · 끝에 { done: true }. */
import { SFX_RECIPES9 } from "./sfx9Synth";
for (const kind of Object.keys(SFX_RECIPES9)) {
    const [n, make] = SFX_RECIPES9[kind];
    const pcms = [];
    for (let v = 0; v < n; v += 1)
        pcms.push(make(v).buffer);
    self.postMessage({ kind, pcms }, pcms);
}
self.postMessage({ done: true });
