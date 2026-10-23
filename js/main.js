import { SIZE, LETTERS, FILLABLE, CENTER, isFree } from './config.js';
import { validateGrid } from './validation.js';
import { generateGrid, fillBlanks, emptyGrid } from './random.js';
import { findCompletedLines, LINES } from './bingo.js';
import { launchConfetti } from './confetti.js';
import { beep, fanfare, setSound, isSoundOn } from './sound.js';

// 遊戲資料只存在記憶體（不使用 localStorage / IndexedDB）
let mode = 'edit'; // 'edit' | 'play'
let grid = emptyGrid();
let marked = newMarked();
let cells = {};
let notice = '';
let prevLines = 0;
let animate = true; // 只在整張重建時播放入場動畫

const $ = id => document.getElementById(id);
const gridEl = $('grid'), progressEl = $('progress'), messagesEl = $('messages');
const bannerEl = $('banner'), introEl = $('intro'), hintEl = $('hint');
const btn = { random: $('btn-random'), fill: $('btn-fill'), clear: $('btn-clear'), done: $('btn-done'), unmark: $('btn-unmark'), restart: $('btn-restart') };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function newMarked() {
  const m = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  m[CENTER][CENTER] = true;
  return m;
}

/* ---------- 小工具：對話框、提示、震動 ---------- */
function ask(title, text, okLabel = '確定') {
  const dlg = $('dlg');
  $('dlg-title').textContent = title; $('dlg-text').textContent = text; $('dlg-ok').textContent = okLabel;
  return new Promise(res => { dlg.addEventListener('close', () => res(dlg.returnValue === 'ok'), { once: true }); dlg.showModal(); });
}
let toastTimer;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
const buzz = ms => navigator.vibrate?.(ms);
function shake() { const c = $('card'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); buzz([40, 40, 40]); }

/* ---------- 建立格子 ---------- */
function buildGrid() {
  gridEl.replaceChildren();
  cells = {};
  let i = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const wrap = document.createElement('div');
      const key = `${r},${c}`;
      wrap.className = 'cell col-' + c;
      if (animate && !reduced) { wrap.classList.add('enter'); wrap.style.animationDelay = `${i++ * 18}ms`; }
      if (isFree(r, c)) {
        wrap.classList.add('free');
        wrap.innerHTML = '<span>★</span><small>FREE</small>';
        cells[key] = { wrap };
      } else if (mode === 'edit') {
        const input = document.createElement('input');
        input.type = 'text'; input.inputMode = 'numeric'; input.maxLength = 2; input.autocomplete = 'off';
        input.value = grid[r][c];
        input.dataset.r = r; input.dataset.c = c;
        input.setAttribute('aria-label', `第 ${r + 1} 列 ${LETTERS[c]} 欄`);
        input.addEventListener('focus', () => input.select());
        input.addEventListener('input', () => {
          input.value = input.value.replace(/\D/g, '');
          grid[r][c] = input.value; notice = '';
          refresh();
          if (input.value.length === 2) focusNext(r, c, 1); // 填滿兩位自動跳下一格
        });
        input.addEventListener('keydown', e => {
          const d = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }[e.key];
          if (d) { e.preventDefault(); moveFocus(r + d[0], c + d[1]); }
          else if (e.key === 'Enter') { e.preventDefault(); focusNext(r, c, 1); }
          else if (e.key === 'Backspace' && input.value === '') focusNext(r, c, -1);
        });
        wrap.append(input);
        cells[key] = { wrap, el: input };
      } else {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'num'; b.textContent = grid[r][c];
        b.setAttribute('aria-label', `${LETTERS[c]} ${grid[r][c]}`);
        b.addEventListener('click', () => {
          marked[r][c] = !marked[r][c];
          beep(marked[r][c] ? 740 : 420, .07); buzz(12);
          refresh(key);
        });
        wrap.append(b);
        cells[key] = { wrap, el: b };
      }
      gridEl.append(wrap);
    }
  }
  animate = false;
}
function moveFocus(r, c) { cells[`${r},${c}`]?.el?.focus(); }
function focusNext(r, c, step) { // 依閱讀順序（跳過 FREE）移動
  let k = r * SIZE + c + step;
  while (k >= 0 && k < SIZE * SIZE) {
    const rr = Math.floor(k / SIZE), cc = k % SIZE;
    if (!isFree(rr, cc)) return moveFocus(rr, cc);
    k += step;
  }
}

/* ---------- 更新畫面 ---------- */
function refresh(poppedKey) {
  const playing = mode === 'play';
  for (const b of [btn.random, btn.fill, btn.clear, btn.done]) b.hidden = playing;
  btn.unmark.hidden = btn.restart.hidden = !playing;
  $('range-hint').hidden = playing;
  $('step-1').className = playing ? 'done' : 'on';
  $('step-2').className = playing ? 'on' : '';
  document.body.dataset.mode = mode;
  introEl.textContent = playing
    ? '點擊被叫出的號碼來標記，再點一次可取消。'
    : '填入 24 格數字，或使用「隨機產生」。每欄範圍固定，同一張卡不可重複。';
  playing ? refreshPlay(poppedKey) : refreshEdit();
}

function refreshEdit() {
  bannerEl.hidden = true; hintEl.hidden = true;
  const { errors, duplicates, messages, filled } = validateGrid(grid);
  for (const [key, { wrap, el }] of Object.entries(cells)) {
    if (!el) continue;
    const bad = errors.has(key) || duplicates.has(key);
    wrap.classList.toggle('invalid', bad);
    wrap.classList.toggle('filled', el.value !== '' && !bad);
    el.setAttribute('aria-invalid', String(bad));
  }
  $('meter').hidden = false;
  $('meter-bar').style.width = `${(filled / FILLABLE) * 100}%`;
  progressEl.textContent = `已填 ${filled} / ${FILLABLE}`;
  btn.done.classList.toggle('ready', filled === FILLABLE && !messages.length);
  const list = notice ? [notice, ...messages] : messages;
  messagesEl.replaceChildren(...list.map(m => { const li = document.createElement('li'); li.textContent = m; return li; }));
}

function refreshPlay(poppedKey) {
  const lines = findCompletedLines(marked);
  const inLine = new Set(lines.flat().map(([r, c]) => `${r},${c}`));
  let count = 0;
  for (const [key, { wrap }] of Object.entries(cells)) {
    const [r, c] = key.split(',').map(Number);
    const on = marked[r][c];
    if (on) count++;
    wrap.classList.toggle('marked', on);
    wrap.classList.toggle('in-line', on && inLine.has(key));
    wrap.firstElementChild?.setAttribute?.('aria-pressed', String(on));
    if (key === poppedKey && on && !reduced) { wrap.classList.remove('stamp'); void wrap.offsetWidth; wrap.classList.add('stamp'); }
  }
  $('meter').hidden = false;
  $('meter-bar').style.width = `${(count / 25) * 100}%`;
  progressEl.textContent = `已標記 ${count} / 25（含 FREE） ・ 連線 ${lines.length} 條`;
  // 「差一格」提示：哪些線只差一個
  const near = LINES.filter(l => l.filter(([r, c]) => !marked[r][c]).length === 1).length;
  hintEl.hidden = !near;
  hintEl.textContent = near ? `🔥 有 ${near} 條線只差 1 格就 BINGO！` : '';
  messagesEl.replaceChildren();
  bannerEl.hidden = lines.length === 0;
  bannerEl.textContent = lines.length ? `🎉 BINGO！已完成 ${lines.length} 條線` : '';
  if (lines.length > prevLines) {
    bannerEl.classList.remove('pop'); void bannerEl.offsetWidth; bannerEl.classList.add('pop');
    launchConfetti(); fanfare(); buzz([60, 40, 120]);
  }
  prevLines = lines.length;
}

/* ---------- 操作 ---------- */
function setGrid(next, msg) {
  grid = next; notice = ''; animate = true;
  buildGrid(); refresh(); if (msg) toast(msg);
}

async function complete() {
  const { messages, filled } = validateGrid(grid);
  if (filled < FILLABLE) { notice = `還有 ${FILLABLE - filled} 格未填，填滿後才能完成。`; refresh(); shake(); return; }
  if (messages.length) { notice = '請先修正標示的錯誤或重複數字。'; refresh(); shake(); return; }
  if (!await ask('鎖定這張卡片？', '完成後數字將鎖定，無法修改。要開始遊戲嗎？', '開始遊戲')) return;
  mode = 'play'; marked = newMarked(); prevLines = 0; notice = ''; animate = true;
  buildGrid(); refresh(); toast('卡片已鎖定，開始遊戲！');
}

async function restart() {
  if (!await ask('重新開始？', '會清除這張卡片與所有標記，且無法復原。', '重新開始')) return;
  mode = 'edit'; grid = emptyGrid(); marked = newMarked(); prevLines = 0; notice = ''; animate = true;
  buildGrid(); refresh();
}

async function unmarkAll() {
  if (!await ask('清除所有標記？', '數字保持不變，只會取消已標記的格子（FREE 保留）。', '清除標記')) return;
  marked = newMarked(); prevLines = 0; refresh(); toast('已清除標記');
}

// 防呆：遊戲中，或編輯中已填入數字時，重新整理／關閉頁面會先跳出警告
addEventListener('beforeunload', e => {
  if (mode !== 'play' && !grid.some(row => row.some(v => v !== ''))) return;
  e.preventDefault(); e.returnValue = '';
});

btn.random.addEventListener('click', async () => {
  const hasData = grid.some(row => row.some(v => v !== ''));
  if (hasData && !await ask('重新隨機？', '目前填寫的數字會被整張覆蓋。若想保留已填數字，請用「補齊空格」。', '重新隨機')) return;
  setGrid(generateGrid(), '已隨機產生，仍可修改');
});
btn.fill.addEventListener('click', () => setGrid(fillBlanks(grid), '已補齊空格（保留你填的數字）'));
btn.clear.addEventListener('click', async () => {
  if (grid.some(row => row.some(v => v !== '')) && !await ask('清空整張卡片？', '所有已填數字會被清除。', '清空')) return;
  setGrid(emptyGrid());
});
btn.done.addEventListener('click', complete);
btn.unmark.addEventListener('click', unmarkAll);
btn.restart.addEventListener('click', restart);
$('btn-sound').addEventListener('click', e => {
  const on = !isSoundOn(); setSound(on);
  e.currentTarget.textContent = on ? '🔊' : '🔇'; e.currentTarget.setAttribute('aria-pressed', String(on));
  if (on) beep(660); toast(on ? '音效已開啟' : '音效已關閉');
});

buildGrid();
refresh();
