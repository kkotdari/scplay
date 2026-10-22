/* 효과음 굽기 일꾼(2026-10-22, 지적: "소리 추가 후 좀 버벅임") — 24종 × 갈래 2~3벌의 PCM 합성은 데스크톱에서도 한 종류 5~37ms(모두 ~260ms)라,
   메인에서 쉴 틈마다 구우면 폰에선 재생 중 긴 멈춤이 났다. 여기서 다 굽고 종류마다 WAV 바이트를 넘긴다(transfer) — 메인은 Blob 주소만 만든다.
   (워커 → 메인) { kind, wavs: ArrayBuffer[], dur } 종류마다 한 번 · 끝에 { done: true }. */
import { SFX_RATE9, SFX_RECIPES9, wavBytes9, type SfxKind9 } from "./sfx9Synth";

for (const kind of Object.keys(SFX_RECIPES9) as SfxKind9[]) {
  const [n, make] = SFX_RECIPES9[kind];
  let dur = 0;
  const wavs: ArrayBuffer[] = [];
  for (let v = 0; v < n; v += 1) {
    const pcm = make(v);
    dur = Math.max(dur, pcm.length / SFX_RATE9);
    wavs.push(wavBytes9(pcm).buffer as ArrayBuffer);
  }
  (self as unknown as Worker).postMessage({ kind, wavs, dur }, wavs);
}
(self as unknown as Worker).postMessage({ done: true });
