"""Accuracy on known forwards. Run from api/:  python tests/eval/run_eval.py
Add real forwards with known answers (PIB Fact Check, Alt News, BOOM, Factly) to forwards.jsonl; aim for 30."""
import asyncio
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from dotenv import load_dotenv  # noqa: E402

load_dotenv()
import pipeline  # noqa: E402

# "Same meaning" groups: expected FALSE and answer MISLEADING both mean "don't forward"
GROUP = {"FALSE": "bad", "MISLEADING": "bad", "OUTDATED": "old", "TRUE": "good",
         "PARTLY_TRUE": "mixed", "UNVERIFIABLE": "unknown", "NO_CLAIMS": "unknown"}


async def main():
    rows = [json.loads(line) for line in open(Path(__file__).parent / "forwards.jsonl", encoding="utf-8") if line.strip()]
    exact = same = 0
    for i, row in enumerate(rows, 1):
        r = await pipeline.run_check(text=row["text"], use_db=False)
        exact += r["overall"] == row["expected"]
        hit = GROUP[r["overall"]] == GROUP[row["expected"]]
        same += hit
        print(f'{i:02d} expected={row["expected"]:12} got={r["overall"]:12} {"OK " if hit else "BAD"} {row["text"][:60]}')
        time.sleep(8)   # stay under free-tier requests/minute
    print(f"\nExact: {exact}/{len(rows)}  |  Same meaning: {same}/{len(rows)} = {100 * same // max(len(rows), 1)}%")


if __name__ == "__main__":
    asyncio.run(main())
