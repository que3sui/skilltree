"""清洗与聚合：剔除重复/故障记录，按 10 分钟聚合并做缺失时段前向填充。

运行：python src/clean.py  →  data/clean.csv
"""
import csv
from collections import defaultdict
from datetime import datetime, timedelta

RAW = "data/raw.csv"
OUT = "data/clean.csv"
SLOT = timedelta(minutes=10)
# 课程说明：11-03 14:00-15:30 闸机故障，该时段记录不可信，整段剔除
FAULT_START = datetime(2025, 11, 3, 14, 0)
FAULT_END = datetime(2025, 11, 3, 15, 30)

seen = set()
rows = []
dropped_dup = dropped_fault = filled = 0
with open(RAW, newline="", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        t = datetime.fromisoformat(r["time"])
        key = (r["time"], r["station"], r["event"], r["user"])
        if key in seen:
            dropped_dup += 1
            continue
        seen.add(key)
        if FAULT_START <= t <= FAULT_END:
            dropped_fault += 1
            continue
        rows.append((t, r["station"], 1 if r["event"] == "borrow" else -1))

# 聚合到 (slot, station) 的净流量
net = defaultdict(int)
for t, st, sign in rows:
    net[(t.replace(minute=t.minute - t.minute % 10, second=0), st)] += sign

stations = sorted({st for _, st in net})
start = min(t for t, _ in net)
end = max(t for t, _ in net)
with open(OUT, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["slot", "station", "net"])
    t = start
    while t <= end:
        for st in stations:
            if (t, st) not in net:
                filled += 1  # 无记录视为净流量 0（前向填充语义）
            w.writerow([t.isoformat(), st, net.get((t, st), 0)])
        t += SLOT

print(f"clean done: slots={int((end - start) / SLOT) + 1}, stations={len(stations)}, "
      f"dropped_dup={dropped_dup}, dropped_fault={dropped_fault}, filled_zero={filled}")
