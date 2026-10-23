import { SIZE, LETTERS, RANGES, isFree } from './config.js';

/** 單格檢查：空白回傳 null；不合法回傳錯誤訊息字串。 */
export function checkCell(col, raw) {
  if (raw === '') return null;
  if (!/^\d{1,2}$/.test(raw)) return '只能輸入數字';
  const n = Number(raw);
  const [lo, hi] = RANGES[col];
  if (n < lo || n > hi) return `${LETTERS[col]} 欄需為 ${lo}～${hi}`;
  return null;
}

/** 掃描整張卡，回傳 { errors, duplicates, messages, filled } */
export function validateGrid(grid) {
  const errors = new Map();
  const seen = new Map(); // 數字 -> ["r,c", ...]
  let filled = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (isFree(r, c)) continue;
      const raw = grid[r][c];
      if (raw !== '') filled++;
      const msg = checkCell(c, raw);
      if (msg) { errors.set(`${r},${c}`, msg); continue; }
      if (raw === '') continue;
      const n = Number(raw);
      if (!seen.has(n)) seen.set(n, []);
      seen.get(n).push(`${r},${c}`);
    }
  }
  const duplicates = new Set();
  const messages = [];
  for (const [key, msg] of errors) {
    const [r, c] = key.split(',').map(Number);
    messages.push(`第 ${r + 1} 列 ${LETTERS[c]} 欄：${msg}`);
  }
  for (const [n, keys] of seen) {
    if (keys.length > 1) {
      keys.forEach(k => duplicates.add(k));
      messages.push(`數字 ${n} 重複出現 ${keys.length} 次`);
    }
  }
  return { errors, duplicates, messages, filled };
}
