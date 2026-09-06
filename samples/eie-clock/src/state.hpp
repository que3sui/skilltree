// 调时状态机：独立于 Arduino 硬件，桌面可测。
// 状态：RUN → SET_H → SET_M → RUN；K1 短按步进/长按(EVENT_LONG)保存退出。
#pragma once
#include <cstdint>

enum class Mode : uint8_t { RUN, SET_H, SET_M };
enum class KeyEvent : uint8_t { NONE, K1_SHORT, K1_LONG, K2_SHORT };

struct Clock {
  uint8_t hour;    // 0-23
  uint8_t minute;  // 0-59
  uint8_t second;  // 0-59
  Mode mode;
};

// 纯函数：输入当前状态与按键事件，返回下一状态（时间进位：秒→分→时 24 制回卷）
Clock next_state(const Clock &c, KeyEvent ev);
