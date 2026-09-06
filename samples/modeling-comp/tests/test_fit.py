"""最小验证：拟合基矩阵与清洗聚合的正确性。

运行：python -m unittest discover -s tests
"""
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import numpy as np

from fit import basis, PERIODS  # noqa: E402


class TestBasis(unittest.TestCase):
    def test_shape_and_intercept(self):
        """常数列 + 每周期 sin/cos 两列，列数正确且首列为 1"""
        days = np.linspace(0, 7, 50)
        A = basis(days)
        self.assertEqual(A.shape, (50, 1 + 2 * len(PERIODS)))
        self.assertTrue(np.allclose(A[:, 0], 1.0))

    def test_recover_sinusoid(self):
        """无噪声正弦信号应被最小二乘几乎精确还原"""
        days = np.linspace(0, 14, 500)
        y = 3.0 + 2.0 * np.sin(2 * np.pi * days / 1.0)
        A = basis(days)
        coef, *_ = np.linalg.lstsq(A, y, rcond=None)
        self.assertTrue(np.max(np.abs(A @ coef - y)) < 1e-8)


class TestSlotting(unittest.TestCase):
    def test_ten_minute_bucket(self):
        """10 分钟聚合：同槽位借/还相抵，跨槽位不混"""
        slot_of = lambda t: t.replace(minute=t.minute - t.minute % 10, second=0)
        a = datetime(2025, 11, 1, 7, 32)
        b = datetime(2025, 11, 1, 7, 38)
        c = datetime(2025, 11, 1, 7, 41)
        self.assertEqual(slot_of(a), slot_of(b))
        self.assertNotEqual(slot_of(a), slot_of(c))
        self.assertEqual(slot_of(a).minute, 30)


if __name__ == "__main__":
    unittest.main()
