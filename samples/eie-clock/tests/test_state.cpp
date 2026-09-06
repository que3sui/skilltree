// 桌面单元测试：调时状态机（不依赖 Arduino）
// 编译：g++ -std=c++17 -I src tests/test_state.cpp src/state.cpp -o test_state && ./test_state
#include <cassert>
#include <cstdio>
#include "../src/state.hpp"

static void test_carry() {
  Clock c{23, 59, 59, Mode::RUN};
  Clock n = next_state(c, KeyEvent::NONE);
  assert(n.hour == 0 && n.minute == 0 && n.second == 0);  // 24 制回卷
}

static void test_set_hour_flow() {
  Clock c{10, 30, 0, Mode::RUN};
  Clock h = next_state(c, KeyEvent::K1_SHORT);
  assert(h.mode == Mode::SET_H);                           // 进入调时
  Clock h2 = next_state(h, KeyEvent::K2_SHORT);
  assert(h2.hour == 11);                                   // K2 加一
  Clock m = next_state(h2, KeyEvent::K1_SHORT);
  assert(m.mode == Mode::SET_M);
  Clock back = next_state(m, KeyEvent::K1_LONG);
  assert(back.mode == Mode::RUN);                          // 长按保存退出
}

static void test_set_minute_wrap() {
  Clock c{8, 59, 0, Mode::SET_M};
  Clock n = next_state(c, KeyEvent::K2_SHORT);
  assert(n.minute == 0);                                   // 分钟 60 回卷，小时不动
  assert(n.hour == 8);
}

int main() {
  test_carry();
  test_set_hour_flow();
  test_set_minute_wrap();
  std::puts("state machine: all tests passed");
  return 0;
}
