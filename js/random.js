import { SIZE, RANGES, isFree } from './config.js';

function pickUnique(lo, hi, count) {
  const pool = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  for (let i = pool.length - 1; i > 0; i--) { // Fisher–Yates
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

/** 產生整張卡：每欄只用自己的範圍，彼此天然不重複。中央格為空字串。 */
export function generateGrid() {
  const grid = emptyGrid();
  for (let c = 0; c < SIZE; c++) {
    const rows = [...Array(SIZE).keys()].filter(r => !isFree(r, c));
    const nums = pickUnique(RANGES[c][0], RANGES[c][1], rows.length);
    rows.forEach((r, i) => { grid[r][c] = String(nums[i]); });
  }
  return grid;
}

export function emptyGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(''));
}

/** 保留已填且合法的數字，只補齊空格（不會與現有數字重複）。 */
export function fillBlanks(grid) {
  const next = grid.map(row => [...row]);
  for (let c = 0; c < SIZE; c++) {
    const [lo, hi] = RANGES[c];
    const used = new Set(next.map(row => row[c]).filter(v => /^\d{1,2}$/.test(v)).map(Number));
    const free = [];
    for (let n = lo; n <= hi; n++) if (!used.has(n)) free.push(n);
    for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [free[i], free[j]] = [free[j], free[i]]; }
    for (let r = 0; r < SIZE; r++) if (!isFree(r, c) && next[r][c] === '') next[r][c] = String(free.pop());
  }
  return next;
}
