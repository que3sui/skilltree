// clock.ino —— Arduino 入口：主循环每秒调用一次 next_state，并刷 TM1637 显示
#include <Arduino.h>
#include "state.hpp"

constexpr uint8_t PIN_CLK = 2;
constexpr uint8_t PIN_DIO = 3;
constexpr uint8_t PIN_K1 = 5;
constexpr uint8_t PIN_K2 = 6;

static Clock clk = {12, 0, 0, Mode::RUN};

// —— TM1637 位驱动（起始位 + 8bit LSB，应答位忽略，课程设计足够） ——
static void tm_delay() { delayMicroseconds(5); }
static void tm_start() {
  digitalWrite(PIN_CLK, HIGH); digitalWrite(PIN_DIO, HIGH);
  digitalWrite(PIN_DIO, LOW); digitalWrite(PIN_CLK, LOW);
}
static void tm_stop() {
  digitalWrite(PIN_CLK, LOW); digitalWrite(PIN_DIO, LOW);
  digitalWrite(PIN_CLK, HIGH); digitalWrite(PIN_DIO, HIGH);
}
static void tm_byte(uint8_t b) {
  for (uint8_t i = 0; i < 8; i++) {
    digitalWrite(PIN_CLK, LOW);
    digitalWrite(PIN_DIO, b & 1); b >>= 1;
    digitalWrite(PIN_CLK, HIGH);
  }
  // 应答位：抬 DIO 读外设拉低，简化为再给一拍
  digitalWrite(PIN_CLK, LOW); digitalWrite(PIN_CLK, HIGH);
}
static void tm_show(uint8_t h, uint8_t m, bool colon) {
  // 段码表 0-9（共阴）；冒号占用第二位段码的 bit7
  static const uint8_t SEG[10] = {0x3F,0x06,0x5B,0x4F,0x66,0x6D,0x7D,0x07,0x7F,0x6F};
  uint8_t digits[4] = {
    static_cast<uint8_t>(SEG[h / 10]),
    static_cast<uint8_t>(SEG[h % 10] | (colon ? 0x80 : 0)),
    SEG[m / 10], SEG[m % 10]};
  tm_start(); tm_byte(0x40); tm_stop();                    // 写显示寄存器，自动地址
  tm_start(); tm_byte(0xC0);                                // 从第 0 位起
  for (uint8_t d : digits) tm_byte(d);
  tm_stop();
  tm_start(); tm_byte(0x88 | 7); tm_stop();                 // 开显示，亮度 7
}

// —— 按键去抖 + 短/长按识别 ——
static KeyEvent read_key() {
  static uint32_t press_at = 0; static bool down = false;
  static uint32_t last_call = 0; const uint32_t now = millis();
  const uint32_t dt = now - last_call; last_call = now;
  const bool pressed = digitalRead(PIN_K1) == LOW;
  if (pressed && !down) { down = true; press_at = now; return KeyEvent::NONE; }
  if (!pressed && down) {
    down = false;
    return (now - press_at > 800) ? KeyEvent::K1_LONG : KeyEvent::K1_SHORT;
  }
  if (pressed && down && now - press_at > 800) {           // 长按在按住期间即触发一次
    down = false;
    return KeyEvent::K1_LONG;
  }
  if (digitalRead(PIN_K2) == LOW && dt > 200) return KeyEvent::K2_SHORT;
  return KeyEvent::NONE;
}

void setup() {
  pinMode(PIN_CLK, OUTPUT); pinMode(PIN_DIO, OUTPUT);
  pinMode(PIN_K1, INPUT_PULLUP); pinMode(PIN_K2, INPUT_PULLUP);
}

void loop() {
  static uint32_t last_tick = 0;
  const uint32_t now = millis();
  KeyEvent ev = read_key();
  if (now - last_tick >= 1000) { last_tick = now; clk = next_state(clk, ev); }
  else if (ev != KeyEvent::NONE) clk = next_state(clk, ev); // 调时按键即时响应
  const bool blink = (clk.mode == Mode::RUN) ? true : (now / 500) % 2 == 0;
  tm_show(clk.hour, clk.minute, blink);
  delay(10);
}
