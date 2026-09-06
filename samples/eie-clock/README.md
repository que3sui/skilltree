# 数字钟课程设计（Arduino Uno）

电子技术课程设计：用 Arduino Uno 驱动四位共阴数码管实现可调数字钟。

## 功能

- 时:分 显示，秒点闪烁
- 按键 K1 进入调时（小时位闪烁）、K2 加一、K1 再按切换分钟位、长按 K1 退出
- 掉电不保存（课程设计不要求）

## 硬件

- Arduino Uno ×1；TM1637 四位数码管模块 ×1；轻触按键 ×2
- 接线：TM1637 CLK→D2、DIO→D3；K1→D5、K2→D6（内部上拉，按下接地）

## 代码

`src/clock.cpp`：主循环 + TM1637 时序驱动 + 调时状态机（纯函数 `next_state()` 便于桌面测试）。
`tests/test_state.cpp`：调时状态机的桌面单元测试（脱离硬件，可在 PC 上编译运行）。

## 编译与测试

```bash
# 桌面测试（不依赖 Arduino）
g++ -std=c++17 -I src tests/test_state.cpp src/state.cpp -o test_state && ./test_state

# 烧录：Arduino IDE 打开 src/clock.ino（含同目录 clock.cpp/state.cpp），选 Uno，上传
```

## 已知限制

- 晶振温漂每日约 ±2 秒，课程设计精度可接受；未做 DCF/GPS 对时。
