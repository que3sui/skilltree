#include "state.hpp"

Clock next_state(const Clock &c, KeyEvent ev) {
  Clock n = c;
  // 秒进位（每次调用视为 1 秒）
  if (++n.second >= 60) {
    n.second = 0;
    if (++n.minute >= 60) {
      n.minute = 0;
      if (++n.hour >= 24) n.hour = 0;
    }
  }
  // 按键状态机：RUN ↔ SET_H ↔ SET_M；长按 K1 保存回 RUN
  switch (n.mode) {
    case Mode::RUN:
      if (ev == KeyEvent::K1_SHORT) n.mode = Mode::SET_H;
      break;
    case Mode::SET_H:
      if (ev == KeyEvent::K1_SHORT) n.mode = Mode::SET_M;
      else if (ev == KeyEvent::K1_LONG) n.mode = Mode::RUN;
      else if (ev == KeyEvent::K2_SHORT) n.hour = (n.hour + 1) % 24;
      break;
    case Mode::SET_M:
      if (ev == KeyEvent::K1_SHORT || ev == KeyEvent::K1_LONG) n.mode = Mode::RUN;
      else if (ev == KeyEvent::K2_SHORT) n.minute = (n.minute + 1) % 60;
      break;
  }
  // 调时状态下秒不进位（时钟暂停走时，避免设置被走时覆盖）
  if (n.mode != Mode::RUN && c.mode != Mode::RUN) n.second = c.second;
  return n;
}
