#!/usr/bin/env python3
"""음성 만들기: src/content/audio_jobs.json (build.py가 씀) 에 있는데 site/audio 에 없는 것만 생성.
목소리는 마이크로소프트 Nanami(n)·Keita(k)만. edge-tts 사용.
  python3 src/tools/tts.py            없는 것만 만들기
  python3 src/tools/tts.py --prune    안 쓰는 파일 지우기까지
"""
import asyncio, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ADIR = os.path.join(ROOT, "site", "audio")
JOBS = os.path.join(ROOT, "src", "content", "audio_jobs.json")
VOICES = {"n": "ja-JP-NanamiNeural", "k": "ja-JP-KeitaNeural"}

# 이 작업 공간은 프록시가 TLS를 다시 맺으므로 프록시 CA 묶음을 믿게 함(검증은 그대로).
CA = os.path.expanduser("~/.ccr/ca-bundle.crt")
if os.path.exists(CA):
    import certifi
    certifi.where = lambda: CA
import edge_tts  # noqa: E402


async def one(h, job, sem, stat):
    out = os.path.join(ADIR, h + ".mp3")
    async with sem:
        for attempt in range(4):
            try:
                c = edge_tts.Communicate(job["text"], VOICES[job["v"]], rate=job.get("rate", "+0%"))
                await asyncio.wait_for(c.save(out + ".part"), 60)
                if os.path.getsize(out + ".part") < 1500:
                    raise RuntimeError("too small")
                os.replace(out + ".part", out)
                stat["ok"] += 1
                return
            except Exception as e:  # noqa: BLE001
                err = e
                await asyncio.sleep(1.5 * (attempt + 1))
        stat["fail"].append((h, job["id"], str(err)[:80]))


async def main():
    jobs = json.load(open(JOBS, encoding="utf-8"))
    os.makedirs(ADIR, exist_ok=True)
    todo = {h: j for h, j in jobs.items() if not os.path.exists(os.path.join(ADIR, h + ".mp3"))}
    sem = asyncio.Semaphore(4)
    stat = {"ok": 0, "fail": []}
    await asyncio.gather(*(one(h, j, sem, stat) for h, j in todo.items()))
    print("전체 %d · 새로 만든 것 %d · 실패 %d" % (len(jobs), stat["ok"], len(stat["fail"])))
    for f in stat["fail"]:
        print("  ✕", f)
    if "--prune" in sys.argv:
        n = 0
        for f in os.listdir(ADIR):
            if f.endswith(".mp3") and f[:-4] not in jobs:
                os.remove(os.path.join(ADIR, f))
                n += 1
        print("안 쓰는 파일 %d개 지움" % n)
    sys.exit(1 if stat["fail"] else 0)


if __name__ == "__main__":
    asyncio.run(main())
