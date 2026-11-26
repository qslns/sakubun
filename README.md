# sakubun — 분카 작문·면접 드릴

문화복장학원 입학 시험(2026-12-12)의 작문과 면접에 쓸 문장을 외우는 사이트예요.

- 사이트: https://qslns.github.io/sakubun/ (저장소 맨 위의 파일이 그대로 사이트예요)
- 지금 판: c37ed82729 (1126-1916)
- 음성: 마이크로소프트 Nanami(답) · Keita(질문)

## 폴더

- `index.html` `app.js` `data.js` `sw.js` `version.json` `audio/` — 만들어진 사이트(손으로 고치지 않음)
- `src/app` — 앱 원본 · `src/content` — 문장 원본(c3_*.py) · `src/tools` — 빌드 도구 · `src/tests` — 자동 시험 · `src/kvg` — 획순 그림

## 고치는 순서

1. `src/content/c3_*.py` 를 고침 (질문의 순서와 묶음은 `c3_rank.py`)
2. `python3 src/content/content_src.py --release && python3 src/tools/build.py --strict-audio` → `site/`
3. 새 음성: `python3 src/tools/tts.py --prune` · 받아쓰기 검사: `python3 src/tools/asr_check.py`
4. `node src/tests/run.cjs site all` 을 전부 통과한 판만 올림
5. `python3 src/tools/publish_repo.py <저장소 폴더>` → commit → push

공개 저장소라서 이름·나이·다닌 학교 이름은 어디에도 넣지 않아요. 문장 원본의 출처 메모는 괄호 속(서류의 자세한 내용)을 지운 것이에요.

획순 그림(`src/kvg`, 사이트의 글자 쓰기 화면): KanjiVG (© Ulrich Apel, CC BY-SA 3.0, kanjivg.tagaini.net)
