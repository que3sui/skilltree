"""绘制拟合曲线与残差图 → figs/fit.png, figs/residual.png

运行：python src/plot.py
"""
import csv
from datetime import datetime
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

CLEAN = "data/clean.csv"
STATION = "东区教学楼"  # 重点站点示例
PERIODS = [1.0, 0.5, 1.0 / 7]

def main():
    ts, ys = [], []
    with open(CLEAN, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["station"] == STATION:
                ts.append(datetime.fromisoformat(r["slot"]))
                ys.append(float(r["net"]))
    t0 = ts[0]
    days = np.array([(t - t0).total_seconds() / 86400 for t in ts])
    y = np.array(ys)
    A = np.column_stack([np.ones_like(days)] + [f(2 * np.pi * days / p) for p in PERIODS for f in (np.sin, np.cos)])
    coef, *_ = np.linalg.lstsq(A, y, rcond=None)
    fitted = A @ coef

    fig, axes = plt.subplots(2, 1, figsize=(10, 6), sharex=True)
    axes[0].plot(days, y, lw=0.8, label="net flow (10min)")
    axes[0].plot(days, fitted, lw=2, label="Fourier fit")
    axes[0].set_ylabel("net flow")
    axes[0].legend()
    axes[1].plot(days, y - fitted, lw=0.8, color="tab:red")
    axes[1].axhline(0, color="k", lw=0.5)
    axes[1].set_ylabel("residual")
    axes[1].set_xlabel("days")
    fig.suptitle(f"{STATION}：净流量拟合与残差")
    fig.tight_layout()
    fig.savefig("figs/fit.png", dpi=150)
    print("saved figs/fit.png")

    # 残差单独成图（README 与论文引用的是单图版本）
    fig2, ax = plt.subplots(figsize=(10, 3))
    ax.plot(days, y - fitted, lw=0.8, color="tab:red")
    ax.axhline(0, color="k", lw=0.5)
    ax.set_ylabel("residual")
    ax.set_xlabel("days")
    fig2.suptitle(f"{STATION}：残差")
    fig2.tight_layout()
    fig2.savefig("figs/residual.png", dpi=150)
    print("saved figs/residual.png")

if __name__ == "__main__":
    main()
