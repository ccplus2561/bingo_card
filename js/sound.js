// 以 WebAudio 產生簡短音效（無音檔）。預設關閉，由使用者開啟。
let ctx, on = false;
export const isSoundOn = () => on;
export function setSound(v) { on = v; }
export function beep(freq = 660, dur = 0.09, type = 'sine', gain = 0.12) {
  if (!on) return;
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur);
  } catch { /* 靜默失敗 */ }
}
export function fanfare() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, .16, 'triangle', .14), i * 110)); }
