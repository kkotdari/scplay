# 재생기 글꼴 (2026-10-16)

재생기 안(`.scr-motion-root` · `.scr-fs-layer` · `.scr-guide-overlay`)에만 쓴다 — 사이트(sg-web)는 안 바꾼다.

| 파일 | 글꼴 | 쓰임 | 라이선스 |
|---|---|---|---|
| `NanumSquareNeo-bRg/cBd/dEb/eHv.woff2` | 나눔스퀘어 네오 (NAVER) 400·700·800·900 | 한글 | SIL Open Font License 1.1 (네이버 나눔 글꼴) — 받은 woff2 그대로(고치지 않음) |
| `AGA-Rasheeq-Regular.ttf` | AGA Rasheeq V.2 (Almedia Interactive · Mohammad Alagha) | 영문·숫자·문장부호(unicode-range) | © Almedia Interactive — 배포처(FontSpace) 표기 **비상업 무료**, 상업 이용은 제작사(almedia.net) 라이선스 필요. 파일은 고치지 않는다 |

크기·높이 맞춤(이 폴더 `scplay-fonts.css` 의 `@font-face "SCP Rasheeq"` · 패키지 `scplay/fonts.css`): 대문자 높이 0.443em → 나눔스퀘어 네오 영문 대문자 0.707em 에 맞춰 `size-adjust: 160%`,
줄 높이 기준은 나눔스퀘어 네오(위 0.85 · 아래 0.255)와 같게 `ascent-override 53.2%` · `descent-override 16%` · `line-gap-override 0%`(size-adjust 를 곱하기 전 값).
