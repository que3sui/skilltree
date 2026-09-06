"""傅里叶基最小二乘拟合各站点净流量，第二周留出验证。

运行：python src/fit.py  →  终端输出各站点拟合与验证残差
"""
import csv
from datetime import datetime
import numpy as np

CLEAN = "data/clean.csv"
PERIODS = [1.0, 0.5, 1.0 / 7]  # 一天 / 半天 / 一周（天）

def load():
    data = {}
    with open(CLEAN, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            t = datetime.fromisoformat(r["slot"])
            data.setdefault(r["station"], []).append((t, float(r["net"])))
    return {st: sorted(v) for st, v in data.items()}

def basis(days):
    """傅里叶基设计矩阵：常数 + 每周期的 sin/cos（取一阶谐波）"""
    cols = [np.ones_like(days)]
    for p in PERIODS:
        cols += [np.sin(2 * np.pi * days / p), np.cos(2 * np.pi * days / p)]
    return np.column_stack(cols)

def main():
    data = load()
    t0 = min(ts[0] for ts in data.values())
    print("station, train_rmse, holdout_rmse")
    for st, ts in data.items():
        days = np.array([(t - t0).total_seconds() / 86400 for t, _ in ts])
        y = np.array([v for _, v in ts])
        # 留出：按时间顺序取后半段做验证（数据已按时间排序）
        cut = len(days) // 2
        cut_day = days[max(cut - 1, 0)] if 0 < cut < len(days) else days[len(days) // 2]
        train_mask = days <= cut_day
        holdout_mask = ~train_mask
        A_tr, y_tr = basis(days[train_mask]), y[train_mask]
        coef, *_ = np.linalg.lstsq(A_tr, y_tr, rcond=None)
        rmse = lambda A, y: float(np.sqrt(np.mean((A @ coef - y) ** 2)))
        print(f"{st}, {rmse(A_tr, y_tr):.3f}, {rmse(basis(days[holdout_mask]), y[holdout_mask]):.3f}")

if __name__ == "__main__":
    main()
