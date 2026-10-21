"""Rebuild data/seed.js from the JSON files in data/.

seed.js is only the fallback for double-clicking index.html (browsers block fetch() of local files).
Run `python tools/build_seed.py` from the prototype_2 folder after editing any data/*.json.
"""
import json, pathlib

data = pathlib.Path(__file__).resolve().parent.parent / "data"
seed = {name: json.loads((data / f"{name}.json").read_text(encoding="utf-8")) for name in ("listings", "users", "settings")}
(data / "seed.js").write_text("window.MF_SEED = " + json.dumps(seed, ensure_ascii=False) + ";\n", encoding="utf-8")
print("wrote data/seed.js")
