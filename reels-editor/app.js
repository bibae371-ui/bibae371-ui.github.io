/* ==========================================================
   릴스 스튜디오 · 9:16 인스타 릴스 웹 편집기
   정적 HTML/CSS/JS. 모든 처리는 브라우저 안에서만.
   ========================================================== */
'use strict';

const W = 1080, H = 1920;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wait = ms => new Promise(r => setTimeout(r, ms));

const FONT_LIST = [
  "'Pretendard', sans-serif",
  "'Black Han Sans', sans-serif",
  "'Noto Sans KR', sans-serif",
  "'Gmarket Sans', sans-serif",
  "'Nanum Gothic', sans-serif",
  "'Do Hyeon', sans-serif",
  "'Jua', sans-serif",
  "'Gowun Dodum', sans-serif",
  "'Noto Serif KR', serif"
];

const S = {
  clips: [],          // {id,kind:'video'|'image'|'color',url,el,name,dur,trimStart,trimEnd,volume,grad,color,color2,dir,thumb}
  texts: [],          // {id,text,start,end,font,size,weight,color,x,y,align,lineHeight,maxW,bg,stroke,shadow}
  t: 0,
  playing: false,
  selClip: null,
  selText: null,
  muted: false,
  guides: false,
  zoom: 1,
  res: 1080,
  fps: 30,
  fmt: 'auto',
  exporting: false,
  ready: false
};

const EXPORT = { resolve: null, cancel: false, rec: null, w: 0, h: 0, scale: 1, chunks: [], blobUrl: null };

const canvas = $('#c');
const ctx = canvas.getContext('2d', { alpha: false });

/* ---------------------------------------------------------
   유틸
--------------------------------------------------------- */
function fmtTime(t) {
  t = Math.max(0, t || 0);
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
function fmtSize(b) {
  if (b > 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + 'MB';
  return Math.round(b / 1024) + 'KB';
}
function hexA(hex, a) {
  const h = (hex || '#000000').replace('#', '');
  const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(n.slice(0, 2), 16) || 0, g = parseInt(n.slice(2, 4), 16) || 0, b = parseInt(n.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${a})`;
}
function toast(msg, ms = 2400) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('on'), ms);
}
function deepMerge(base, over) {
  const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
  for (const k in over) {
    const v = over[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') out[k] = deepMerge(base[k], v);
    else out[k] = v;
  }
  return out;
}
function getPath(o, p) { return p.split('.').reduce((a, k) => (a == null ? a : a[k]), o); }
function setPath(o, p, v) {
  const ks = p.split('.');
  let t = o;
  for (let i = 0; i < ks.length - 1; i++) t = t[ks[i]];
  t[ks[ks.length - 1]] = v;
}

/* ---------------------------------------------------------
   타임라인 계산
--------------------------------------------------------- */
const clipDur = c => (c.kind === 'video' ? Math.max(0.1, c.trimEnd - c.trimStart) : Math.max(0.3, c.dur || 3));
function totalDur() { return S.clips.reduce((a, c) => a + clipDur(c), 0); }
function clipScreen() { return S.clips.map(c => clipDur(c)); }
function clipStart(i) { let s = 0; for (let k = 0; k < i; k++) s += clipDur(S.clips[k]); return s; }
function clipAt(t) {
  if (!S.clips.length) return null;
  let acc = 0;
  for (let i = 0; i < S.clips.length; i++) {
    const c = S.clips[i], d = clipDur(c);
    if (t < acc + d || i === S.clips.length - 1) return { i, clip: c, start: acc, local: clamp(t - acc, 0, d), dur: d };
    acc += d;
  }
  return null;
}

/* ---------------------------------------------------------
   클립 생성 / 관리
--------------------------------------------------------- */
const pool = document.createElement('div');
pool.id = 'mediaPool';
pool.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;overflow:hidden;opacity:.001;pointer-events:none';
document.body.appendChild(pool);

async function makeClipFromFile(file) {
  const url = URL.createObjectURL(file);
  if (file.type.startsWith('video') || /\.(mp4|mov|webm|m4v)$/i.test(file.name)) {
    const v = document.createElement('video');
    v.src = url;
    v.muted = false;
    v.volume = 1;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    v.preload = 'auto';
    v.crossOrigin = 'anonymous';
    pool.appendChild(v);
    await new Promise(res => {
      let done = false;
      const fin = () => { if (!done) { done = true; res(); } };
      v.onloadedmetadata = fin; v.onerror = fin;
      setTimeout(fin, 6000);
    });
    if (v.error) {
      URL.revokeObjectURL(url);
      pool.removeChild(v);
      toast('이 영상은 브라우저에서 재생할 수 없습니다. MP4(H.264)로 변환해 주세요.', 4200);
      return null;
    }
    // 일부 WebM/스트림 파일은 duration이 Infinity로 나온다. 끝으로 시킹해 길이를 확정한다.
    if (!isFinite(v.duration) || v.duration <= 0) {
      await new Promise(res => {
        let done = false;
        const fin = () => { if (done) return; done = true; v.removeEventListener('seeked', fin); res(); };
        v.addEventListener('seeked', fin);
        try { v.currentTime = 1e6; } catch (e) { fin(); }
        setTimeout(fin, 1800);
      });
      try { v.currentTime = 0; } catch (e) { }
    }
    const d = isFinite(v.duration) && v.duration > 0 ? v.duration : 5;
    const clip = { id: uid(), kind: 'video', name: file.name, url, el: v, dur: d, trimStart: 0, trimEnd: d, volume: 1, thumb: null };
    grabThumb(clip);
    return clip;
  }
  if (file.type.startsWith('image') || /\.(png|jpe?g|webp|gif|avif)$/i.test(file.name)) {
    const img = new Image();
    img.src = url;
    img.decoding = 'sync';
    await new Promise(res => { img.onload = res; img.onerror = res; setTimeout(res, 6000); });
    return { id: uid(), kind: 'image', name: file.name, url, el: img, dur: 3, trimStart: 0, trimEnd: 3, volume: 1, thumb: url };
  }
  URL.revokeObjectURL(url);
  toast('지원하지 않는 파일 형식입니다.');
  return null;
}

function grabThumb(clip) {
  const v = clip.el;
  const work = () => {
    try {
      const cv = document.createElement('canvas');
      cv.width = 104; cv.height = 128;
      const g = cv.getContext('2d');
      const vw = v.videoWidth || 1080, vh = v.videoHeight || 1920;
      const sc = Math.max(104 / vw, 128 / vh);
      g.fillStyle = '#000'; g.fillRect(0, 0, 104, 128);
      g.drawImage(v, (104 - vw * sc) / 2, (128 - vh * sc) / 2, vw * sc, vh * sc);
      clip.thumb = cv.toDataURL('image/jpeg', 0.72);
      renderClipList();
    } catch (e) { /* 썸네일 실패는 무시 */ }
  };
  const t = Math.min(clip.trimStart + 0.1, Math.max(0, clip.dur - 0.05));
  if (v.readyState >= 2 && Math.abs(v.currentTime - t) < 0.05) work();
  else {
    v.addEventListener('seeked', work, { once: true });
    try { v.currentTime = t; } catch (e) { }
  }
}

function addClip(clip, at) {
  if (!clip) return;
  if (typeof at === 'number' && at >= 0 && at <= S.clips.length) S.clips.splice(at, 0, clip);
  else S.clips.push(clip);
  S.selClip = clip.id;
  renderAll();
}

function disposeClip(c) {
  if (c.kind === 'video') {
    try { c.el.pause(); } catch (e) { }
    if (c.el.parentNode) c.el.parentNode.removeChild(c.el);
  }
  if (c.url) URL.revokeObjectURL(c.url);
}

function removeClip(id) {
  const i = S.clips.findIndex(c => c.id === id);
  if (i < 0) return;
  const [c] = S.clips.splice(i, 1);
  disposeClip(c);
  if (S.selClip === id) S.selClip = S.clips[Math.min(i, S.clips.length - 1)]?.id || null;
  S.t = clamp(S.t, 0, totalDur());
  renderAll();
}

function moveClip(id, dir) {
  const i = S.clips.findIndex(c => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= S.clips.length) return;
  const [c] = S.clips.splice(i, 1);
  S.clips.splice(j, 0, c);
  renderAll();
}

async function replaceClipFile(id, file) {
  const i = S.clips.findIndex(c => c.id === id);
  if (i < 0) return;
  const old = S.clips[i];
  const nc = await makeClipFromFile(file);
  if (!nc) return;
  nc.trimStart = 0;
  nc.trimEnd = nc.kind === 'video' ? nc.el.duration : 3;
  S.clips[i] = nc;
  disposeClip(old);
  S.selClip = nc.id;
  renderAll();
  toast('클립을 교체했습니다.');
}

function addColorClip(grad) {
  const c1 = $('#c1').value, c2 = $('#c2').value;
  const clip = {
    id: uid(), kind: 'color', name: grad ? '그라데이션 배경' : '단색 배경',
    color: c1, color2: c2, grad: !!grad, dir: 'v', dur: 3, trimStart: 0, trimEnd: 3, volume: 1, thumb: null
  };
  addClip(clip);
}

/* ---------------------------------------------------------
   텍스트 모델
--------------------------------------------------------- */
function newText(o = {}) {
  const total = totalDur() || 5;
  const start = clamp(S.t, 0, Math.max(0, total - 0.4));
  const end = Math.min(total, start + 3);
  const base = {
    id: uid(), text: '자막을 입력하세요', start, end,
    font: FONT_LIST[0], size: 64, weight: 800, color: '#ffffff',
    x: 0.5, y: 0.5, align: 'center', lineHeight: 1.25, maxW: 0.86,
    bg: { on: false, color: '#000000', alpha: 0.55, radius: 28, padX: 28 },
    stroke: { color: '#000000', width: 0 },
    shadow: { on: true, color: '#000000', blur: 14, x: 0, y: 4 }
  };
  return deepMerge(base, o);
}
function selTextObj() { return S.texts.find(t => t.id === S.selText) || null; }

function addText(o) {
  if (!S.clips.length) {
    // 텍스트만 먼저 만들 수 있게 기본 배경 클립을 깔아준다
    addClip({ id: uid(), kind: 'color', name: '기본 배경', color: '#0d0f16', color2: '#1c2333', grad: true, dir: 'v', dur: 5, trimStart: 0, trimEnd: 5, volume: 1 });
  }
  const t = newText(o);
  if (t.end - t.start < 0.3) { t.start = 0; t.end = Math.min(totalDur(), 3); }
  S.texts.push(t);
  S.selText = t.id;
  renderAll();
  switchTab('texts');
  const ed = $('#textEditor');
  if (ed) setTimeout(() => $('#txText')?.focus(), 60);
}

function removeText(id) {
  const i = S.texts.findIndex(t => t.id === id);
  if (i < 0) return;
  S.texts.splice(i, 1);
  if (S.selText === id) S.selText = S.texts[Math.min(i, S.texts.length - 1)]?.id || null;
  renderAll();
}
function dupText(id) {
  const t = S.texts.find(x => x.id === id);
  if (!t) return;
  const c = deepMerge(t, { id: uid() });
  c.start = clamp(t.start + 0.3, 0, Math.max(0, totalDur() - 0.4));
  c.end = Math.min(totalDur(), c.start + (t.end - t.start));
  S.texts.push(c);
  S.selText = c.id;
  renderAll();
}
function moveText(id, dir) {
  const i = S.texts.findIndex(t => t.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= S.texts.length) return;
  const [t] = S.texts.splice(i, 1);
  S.texts.splice(j, 0, t);
  renderAll();
}

/* ---------------------------------------------------------
   캔버스 렌더링
--------------------------------------------------------- */
function fontCss(it) {
  const w = it.weight || 700;
  return `${w} ${it.size}px ${it.font}`;
}

function wrapLines(c, text, maxW) {
  const out = [];
  const raw = String(text == null ? '' : text);
  for (const seg of raw.split('\n')) {
    if (seg === '') { out.push(''); continue; }
    const words = seg.split(' ');
    let line = '';
    const splitLong = (word) => {
      let cur = '';
      for (const ch of word) {
        if (cur && c.measureText(cur + ch).width > maxW) { out.push(cur); cur = ch; }
        else cur += ch;
      }
      return cur;
    };
    for (const w of words) {
      const cand = line ? line + ' ' + w : w;
      if (c.measureText(cand).width <= maxW) { line = cand; }
      else if (!line) { line = splitLong(w); }
      else { out.push(line); line = splitLong(w); }
    }
    out.push(line);
  }
  return out.length ? out : [''];
}

function layoutText(c, it) {
  c.font = fontCss(it);
  const maxW = W * (it.maxW || 0.86);
  const lines = wrapLines(c, it.text, maxW);
  const lh = it.size * (it.lineHeight || 1.25);
  const widths = lines.map(l => c.measureText(l).width);
  const maxLineW = Math.max(1, ...widths);
  const totalH = lh * lines.length;
  const cx = it.x * W;
  const cy = it.y * H;
  const padX = it.bg.padX || 0;
  const padY = Math.round(padX * 0.45);
  const textTop = cy - totalH / 2;
  return {
    lines, widths, lh, totalH, maxLineW, cx, cy, padX, padY, textTop,
    box: {
      x: cx - maxLineW / 2 - padX,
      y: textTop - padY,
      w: maxLineW + padX * 2,
      h: totalH + padY * 2
    }
  };
}

function roundRect(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function drawTextItem(c, it) {
  const L = layoutText(c, it);
  it._box = L.box;

  // 배경 박스
  if (it.bg.on && L.box.w > 0) {
    c.save();
    c.fillStyle = hexA(it.bg.color, it.bg.alpha);
    roundRect(c, L.box.x, L.box.y, L.box.w, L.box.h, it.bg.radius || 0);
    c.fill();
    c.restore();
  }

  c.save();
  c.textBaseline = 'middle';
  c.textAlign = it.align === 'left' ? 'left' : it.align === 'right' ? 'right' : 'center';
  const anchorX = it.align === 'left' ? L.cx - L.maxLineW / 2 : it.align === 'right' ? L.cx + L.maxLineW / 2 : L.cx;
  c.lineJoin = 'round';
  c.miterLimit = 2;

  for (let i = 0; i < L.lines.length; i++) {
    const line = L.lines[i];
    if (!line) continue;
    const ly = L.textTop + L.lh * (i + 0.5);

    if (it.shadow.on && it.shadow.blur >= 0) {
      c.shadowColor = hexA(it.shadow.color, 0.9);
      c.shadowBlur = it.shadow.blur;
      c.shadowOffsetX = it.shadow.x || 0;
      c.shadowOffsetY = it.shadow.y || 0;
    } else {
      c.shadowColor = 'transparent';
      c.shadowBlur = 0;
      c.shadowOffsetX = 0;
      c.shadowOffsetY = 0;
    }

    if (it.stroke.width > 0) {
      c.lineWidth = it.stroke.width;
      c.strokeStyle = it.stroke.color;
      c.strokeText(line, anchorX, ly);
    }
    c.shadowColor = 'transparent';
    c.shadowBlur = 0;
    c.shadowOffsetX = 0;
    c.shadowOffsetY = 0;
    c.fillStyle = it.color;
    c.fillText(line, anchorX, ly);
  }
  c.restore();
}

function drawClipFrame(c, clip) {
  if (clip.kind === 'video') {
    const v = clip.el;
    if (v.readyState >= 2) {
      const vw = v.videoWidth || W, vh = v.videoHeight || H;
      const sc = Math.max(W / vw, H / vh);
      const dw = vw * sc, dh = vh * sc;
      try { c.drawImage(v, (W - dw) / 2, (H - dh) / 2, dw, dh); } catch (e) { }
    }
  } else if (clip.kind === 'image') {
    const im = clip.el;
    const iw = im.naturalWidth || W, ih = im.naturalHeight || H;
    const sc = Math.max(W / iw, H / ih);
    const dw = iw * sc, dh = ih * sc;
    try { c.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh); } catch (e) { }
  } else {
    if (clip.grad) {
      let g;
      if (clip.dir === 'h') g = c.createLinearGradient(0, 0, W, 0);
      else if (clip.dir === 'd') g = c.createLinearGradient(0, 0, W, H);
      else g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, clip.color || '#000');
      g.addColorStop(1, clip.color2 || '#111');
      c.fillStyle = g;
    } else {
      c.fillStyle = clip.color || '#000';
    }
    c.fillRect(0, 0, W, H);
  }
}

function drawGuides(c) {
  c.save();
  c.strokeStyle = 'rgba(255,255,255,.28)';
  c.lineWidth = 2;
  c.setLineDash([14, 12]);
  // 인스타 UI 가림 영역 (상단 12%, 하단 22%)
  c.strokeRect(1, 1, W - 2, H * 0.12);
  c.strokeRect(1, H * 0.78, W - 2, H * 0.22 - 2);
  // 안전 여백
  c.setLineDash([8, 10]);
  c.strokeStyle = 'rgba(255,210,63,.22)';
  c.strokeRect(W * 0.05, H * 0.05, W * 0.9, H * 0.9);
  c.restore();
}

function drawEmpty(c) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#121722');
  g.addColorStop(1, '#080a10');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  c.save();
  c.textAlign = 'center';
  c.fillStyle = 'rgba(255,255,255,.30)';
  c.font = "800 64px 'Pretendard', sans-serif";
  c.fillText('클립을 추가하거나', W / 2, H / 2 - 50);
  c.fillText('프리셋을 눌러 시작하세요', W / 2, H / 2 + 40);
  c.font = "500 34px 'Pretendard', sans-serif";
  c.fillStyle = 'rgba(255,255,255,.16)';
  c.fillText('9:16 · 1080×1920', W / 2, H / 2 + 150);
  c.restore();
}

function draw(t) {
  const sc = EXPORT.scale || 1;
  if (sc !== 1) ctx.setTransform(sc, 0, 0, sc, 0, 0);
  else ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  if (!S.clips.length) {
    drawEmpty(ctx);
  } else {
    const ca = clipAt(t);
    if (ca) drawClipFrame(ctx, ca.clip);
  }

  // 자막
  for (const it of S.texts) {
    if (t + 0.001 >= it.start && t < it.end) drawTextItem(ctx, it);
  }

  if (S.guides && !S.exporting) drawGuides(ctx);

  // 선택 표시
  if (!S.exporting) {
    const sel = selTextObj();
    if (sel && sel._box && t >= sel.start && t < sel.end) {
      ctx.save();
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 10]);
      ctx.strokeRect(sel._box.x - 6, sel._box.y - 6, sel._box.w + 12, sel._box.h + 12);
      ctx.restore();
    }
  }
  ctx.restore();
}

/* ---------------------------------------------------------
   재생 엔진
--------------------------------------------------------- */
let raf = 0, lastTs = 0;

function pauseAllVideos(except) {
  for (const c of S.clips) {
    if (c.kind === 'video' && c !== except && !c.el.paused) { try { c.el.pause(); } catch (e) { } }
  }
}

function applyVolume(c) {
  const v = clamp(c.volume == null ? 1 : c.volume, 0, 1);
  if (c.kind === 'video') {
    if (c._gain) c._gain.gain.value = v; else c.el.volume = v;
    c.el.muted = S.muted || v === 0;
  }
}

function enterClipAt(t, autoplay) {
  const ca = clipAt(t);
  if (!ca) return;
  pauseAllVideos(ca.clip.kind === 'video' ? ca.clip : null);
  if (ca.clip.kind === 'video') {
    const v = ca.clip.el;
    const target = clamp(ca.clip.trimStart + ca.local, 0, Math.max(0, ca.clip.dur - 0.05));
    if (Math.abs(v.currentTime - target) > 0.15 && v.readyState >= 1) {
      try { v.currentTime = target; } catch (e) { }
    }
    if (autoplay) { v.play().catch(() => { }); }
    // 다음 클립 미리 시킹 (전환 끊김 완화)
    const next = S.clips[ca.i + 1];
    if (next && next.kind === 'video' && next !== ca.clip && !next.el.seeking) {
      try { next.el.currentTime = clamp(next.trimStart, 0, Math.max(0, (next.dur || 1) - 0.1)); } catch (e) { }
    }
  }
}

function play(fromStart) {
  if (S.exporting && !EXPORT.resolve) return;
  if (!S.clips.length) { toast('먼저 클립을 추가하세요.'); return; }
  const total = totalDur();
  if (S.playing) return;
  if (fromStart || S.t >= total - 0.03) S.t = 0;
  S.playing = true;
  $('#btnPlay').textContent = '❚❚';
  enterClipAt(S.t, true);
  lastTs = performance.now();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(loop);
}

function pause() {
  S.playing = false;
  $('#btnPlay').textContent = '▶';
  cancelAnimationFrame(raf);
  pauseAllVideos(null);
}

function stopAtEnd() {
  pause();
  S.t = Math.max(0, totalDur() - 0.001);
  draw(S.t);
  updateTimeUI();
  if (EXPORT.resolve) {
    const r = EXPORT.resolve;
    EXPORT.resolve = null;
    setTimeout(r, 120);
  }
}

function loop(ts) {
  if (!S.playing) return;
  if (S.exporting && EXPORT.cancel) { stopAtEnd(); return; }
  const total = totalDur();
  const dt = Math.min(0.12, Math.max(0, (ts - lastTs) / 1000));
  lastTs = ts;

  const ca = clipAt(S.t);
  if (!ca) { stopAtEnd(); return; }

  if (ca.clip.kind === 'video') {
    const v = ca.clip.el;
    if (!v.seeking && v.readyState >= 2) {
      if (v.paused) v.play().catch(() => { });
      const vt = ca.start + (v.currentTime - ca.clip.trimStart);
      if (v.currentTime >= ca.clip.trimEnd - 0.03 || v.ended) {
        S.t = ca.start + ca.dur;
        if (S.t >= total - 0.01) { stopAtEnd(); return; }
        enterClipAt(S.t, true);
      } else if (vt > S.t) {
        S.t = Math.min(vt, ca.start + ca.dur);
      }
    } else {
      // 시킹 중: 살짝 대기
    }
  } else {
    S.t += dt;
    if (S.t >= ca.start + ca.dur) {
      if (S.t >= total - 0.01) { stopAtEnd(); return; }
      enterClipAt(S.t, true);
    }
  }

  draw(S.t);
  updateTimeUI();
  if (S.exporting) updateExportProgress();

  raf = requestAnimationFrame(loop);
}

function seekTo(t, keepPlaying) {
  const total = totalDur();
  S.t = clamp(t, 0, Math.max(0, total));
  if (S.playing && !keepPlaying) {
    enterClipAt(S.t, true);
  } else {
    pauseAllVideos(null);
    if (S.clips.length) enterClipAt(S.t, false);
  }
  draw(S.t);
  updateTimeUI();
}

function updateTimeUI() {
  const total = totalDur();
  $('#timeNow').textContent = fmtTime(S.t);
  $('#timeTotal').textContent = fmtTime(total);
  const seek = $('#seek');
  if (document.activeElement !== seek) seek.value = total ? String(Math.round(S.t / total * 1000)) : '0';
  const ph = $('#playhead');
  ph.style.left = (total ? (S.t / total * 100) : 0) + '%';
  ph.style.display = S.clips.length ? 'block' : 'none';
}

/* ---------------------------------------------------------
   클립 목록 UI
--------------------------------------------------------- */
function renderClipList() {
  const box = $('#clipList');
  if (!S.clips.length) {
    box.innerHTML = '<div class="empty">아직 클립이 없습니다.<br>영상을 올리거나 배경을 추가해 보세요.</div>';
    return;
  }
  box.innerHTML = S.clips.map((c, i) => {
    const d = clipDur(c);
    const isV = c.kind === 'video';
    const thumb = c.thumb ? `<img src="${c.thumb}" alt="">`
      : (c.kind === 'color' ? `<div class="grad" style="background:${c.grad ? `linear-gradient(160deg,${c.color},${c.color2})` : c.color}"></div>` : '');
    const kindLabel = isV ? '영상' : c.kind === 'image' ? '이미지' : (c.grad ? '그라데이션' : '단색');
    const trim = isV ? `
      <div class="trim">
        <label>IN <input type="range" data-t="in" min="0" max="${(c.dur - 0.2).toFixed(2)}" step="0.05" value="${c.trimStart}"><b>${c.trimStart.toFixed(1)}s</b></label>
        <label>OUT <input type="range" data-t="out" min="0.2" max="${c.dur.toFixed(2)}" step="0.05" value="${c.trimEnd}"><b>${c.trimEnd.toFixed(1)}s</b></label>
      </div>` : `
      <div class="numrow">길이 <input type="number" data-t="dur" min="0.5" max="120" step="0.5" value="${d.toFixed(1)}"> 초
        ${c.kind === 'image' ? `<label class="mini" style="flex-direction:row;align-items:center;gap:5px;margin-left:auto">음량
          <input type="range" data-t="vol" min="0" max="1" step="0.05" value="${c.volume}" style="width:64px;accent-color:var(--red)">
        </label>` : ''}
      </div>`;
    return `<div class="clip ${S.selClip === c.id ? 'sel' : ''}" data-id="${c.id}">
      <div class="clip-top">
        <div class="thumb">${thumb}<span class="k">${kindLabel}</span></div>
        <div class="cinfo">
          <div class="cname">${escapeHtml(c.name)}</div>
          <div class="cmeta">${d.toFixed(1)}초 · 컷 ${c.trimStart.toFixed(1)}~${(isV ? c.trimEnd : d).toFixed(1)}s</div>
          ${isV ? `<div class="numrow">음량 <input type="range" data-t="vol" min="0" max="1" step="0.05" value="${c.volume}" style="flex:1;accent-color:var(--red)"></div>` : ''}
        </div>
        <div class="cbtns">
          <button data-act="up" title="위로">▲</button>
          <button data-act="down" title="아래로">▼</button>
          <button data-act="swap" title="파일 교체">⟳</button>
          <button data-act="del" title="삭제">✕</button>
        </div>
      </div>
      ${trim}
    </div>`;
  }).join('');
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

$('#clipList').addEventListener('click', e => {
  const row = e.target.closest('.clip');
  if (!row) return;
  const id = row.dataset.id;
  const btn = e.target.closest('button[data-act]');
  if (!btn) { S.selClip = id; renderClipList(); draw(S.t); return; }
  const act = btn.dataset.act;
  if (act === 'up') moveClip(id, -1);
  else if (act === 'down') moveClip(id, 1);
  else if (act === 'del') removeClip(id);
  else if (act === 'swap') {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'video/*,image/*';
    inp.onchange = () => { if (inp.files && inp.files[0]) replaceClipFile(id, inp.files[0]); };
    inp.click();
  }
});

$('#clipList').addEventListener('input', e => {
  const row = e.target.closest('.clip');
  if (!row) return;
  const c = S.clips.find(x => x.id === row.dataset.id);
  if (!c) return;
  const kind = e.target.dataset.t;
  const v = parseFloat(e.target.value);
  if (kind === 'in') {
    c.trimStart = clamp(v, 0, c.trimEnd - 0.2);
    e.target.value = c.trimStart;
  } else if (kind === 'out') {
    c.trimEnd = clamp(v, c.trimStart + 0.2, c.dur);
    e.target.value = c.trimEnd;
  } else if (kind === 'dur') {
    c.dur = clamp(v || 3, 0.5, 120);
    c.trimStart = 0; c.trimEnd = c.dur;
  } else if (kind === 'vol') {
    c.volume = clamp(v, 0, 1);
    applyVolume(c);
  }
  if (kind === 'in' || kind === 'out') {
    const b = row.querySelectorAll('.trim b');
    if (b[0]) b[0].textContent = c.trimStart.toFixed(1) + 's';
    if (b[1]) b[1].textContent = c.trimEnd.toFixed(1) + 's';
  }
  if (kind === 'in' || kind === 'out' || kind === 'dur') {
    const meta = row.querySelector('.cmeta');
    if (meta) meta.textContent = `${clipDur(c).toFixed(1)}초 · 컷 ${c.trimStart.toFixed(1)}~${(c.kind === 'video' ? c.trimEnd : clipDur(c)).toFixed(1)}s`;
    S.t = clamp(S.t, 0, totalDur());
    renderTimeline(); updateTimeUI(); draw(S.t); updateExportSummary();
  }
});

$('#clipList').addEventListener('change', e => {
  if (e.target.type === 'number') e.target.dispatchEvent(new Event('input', { bubbles: true }));
});

/* ---------------------------------------------------------
   텍스트 목록 / 편집기
--------------------------------------------------------- */
function renderTextList() {
  const box = $('#textList');
  if (!S.texts.length) {
    box.innerHTML = '<div class="empty">자막이 없습니다.<br>위 버튼으로 추가하거나 프리셋을 눌러 보세요.</div>';
    return;
  }
  box.innerHTML = S.texts.map(t => {
    const first = (t.text || '').split('\n')[0] || '(빈 자막)';
    return `<div class="tx ${S.selText === t.id ? 'sel' : ''}" data-id="${t.id}">
      <span class="dot"></span>
      <div class="tt"><b>${escapeHtml(first)}</b><small>${fmtTime(t.start)} ~ ${fmtTime(t.end)}</small></div>
      <button class="x" data-act="del" title="삭제">✕</button>
    </div>`;
  }).join('');
}

$('#textList').addEventListener('click', e => {
  const row = e.target.closest('.tx');
  if (!row) return;
  const id = row.dataset.id;
  if (e.target.closest('button[data-act="del"]')) { removeText(id); return; }
  S.selText = id;
  renderTextList(); syncEditor(); draw(S.t);
  $('#textEditor').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});

function syncEditor() {
  const it = selTextObj();
  const ed = $('#textEditor');
  if (!it) { ed.classList.add('hidden'); return; }
  ed.classList.remove('hidden');
  $$('[data-k]', ed).forEach(el => {
    const v = getPath(it, el.dataset.k);
    if (el.type === 'checkbox') el.checked = !!v;
    else el.value = v;
  });
  const total = totalDur() || 5;
  $$('input[type=range][data-k="start"], input[type=range][data-k="end"]', ed).forEach(el => {
    el.max = Math.max(1, +total.toFixed(2));
  });
  $('#txText').value = it.text;
  updateValLabels();
}

function updateValLabels() {
  const it = selTextObj();
  if (!it) return;
  $$('[data-v]', $('#textEditor')).forEach(el => {
    const v = getPath(it, el.dataset.v);
    el.textContent = typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(2)) : '';
  });
}

$('#textEditor').addEventListener('input', e => {
  const el = e.target.closest('[data-k]');
  const it = selTextObj();
  if (!el || !it) return;
  const k = el.dataset.k;
  let v;
  if (el.type === 'checkbox') v = el.checked;
  else if (el.type === 'range' || el.type === 'number') v = parseFloat(el.value);
  else if (k === 'weight' || k === 'size') v = parseInt(el.value, 10);
  else v = el.value;

  if (k === 'start') { v = clamp(v, 0, it.end - 0.2); el.value = v; }
  if (k === 'end') { v = clamp(v, it.start + 0.2, Math.max(0.2, totalDur() || v)); el.value = v; }

  setPath(it, k, v);
  if (k === 'font' || k === 'weight' || k === 'size') {
    document.fonts.load(fontCss({ ...it, size: Math.min(it.size, 96) }), '가나다ABC').then(() => draw(S.t)).catch(() => { });
  }
  updateValLabels();
  renderTextList();
  renderTextLane();
  draw(S.t);
});

$('#textEditor').addEventListener('change', e => {
  if (e.target.tagName === 'SELECT') e.target.dispatchEvent(new Event('input', { bubbles: true }));
});

$('#txDel').onclick = () => { if (S.selText) removeText(S.selText); };
$('#txDup').onclick = () => { if (S.selText) dupText(S.selText); };
$('#txHere').onclick = () => {
  const it = selTextObj(); if (!it) return;
  const total = totalDur() || 5;
  it.start = clamp(S.t, 0, Math.max(0, total - 0.4));
  it.end = Math.min(total, it.start + 3);
  syncEditor(); draw(S.t); renderTextLane(); renderTextList(); updateExportSummary();
};
$('#txFull').onclick = () => {
  const it = selTextObj(); if (!it) return;
  it.start = 0; it.end = totalDur() || 3;
  syncEditor(); draw(S.t); renderTextLane(); renderTextList();
};

$('#posSeg').addEventListener('click', e => {
  const b = e.target.closest('button[data-pos]');
  const it = selTextObj();
  if (!b || !it) return;
  it.y = b.dataset.pos === 'top' ? 0.16 : b.dataset.pos === 'mid' ? 0.5 : 0.78;
  syncEditor(); draw(S.t);
});

$('#addText').onclick = () => addText();

$('#btnHook').onclick = () => {
  if (!S.clips.length) {
    addClip({ id: uid(), kind: 'color', name: '기본 배경', color: '#12060b', color2: '#3a0d1a', grad: true, dir: 'v', dur: 5, trimStart: 0, trimEnd: 5, volume: 1 });
  }
  const total = totalDur() || 5;
  const t = newText({
    text: '훅 문구를 넣으세요', start: 0, end: total,
    font: FONT_LIST[1], size: 56, weight: 900, y: 0.135, lineHeight: 1.1,
    bg: { on: true, color: '#ff2d55', alpha: 1, radius: 70, padX: 34 },
    stroke: { color: '#000000', width: 0 },
    shadow: { on: true, color: '#000000', blur: 18, x: 0, y: 6 }
  });
  S.texts.push(t); S.selText = t.id;
  renderAll(); switchTab('texts');
  setTimeout(() => { const ta = $('#txText'); ta.focus(); ta.select(); }, 80);
};

/* ---------------------------------------------------------
   타임라인
--------------------------------------------------------- */
function renderTimeline() {
  const lane = $('#laneClips');
  const total = totalDur();
  $('#tlInfo').textContent = S.clips.length
    ? `클립 ${S.clips.length}개 · 자막 ${S.texts.length}개 · 총 ${fmtTime(total)}`
    : '클립을 추가하세요';

  if (!S.clips.length) {
    lane.innerHTML = '';
    $('#laneTexts').innerHTML = '';
    updatePlayhead();
    return;
  }
  lane.innerHTML = S.clips.map((c, i) => {
    const d = clipDur(c);
    const cls = c.kind === 'video' ? 'v' : c.kind === 'image' ? 'i' : 'c';
    return `<div class="clipblk ${cls} ${S.selClip === c.id ? 'sel' : ''}" data-id="${c.id}" style="flex:${d} 1 0" title="${escapeHtml(c.name)}">
      <span class="n">${i + 1}</span><span class="lbl">${escapeHtml(shortName(c.name))} · ${d.toFixed(1)}s</span>
    </div>`;
  }).join('');
  renderTextLane();
  updatePlayhead();
}

function shortName(n) {
  const s = String(n || '').replace(/\.[a-z0-9]+$/i, '');
  return s.length > 12 ? s.slice(0, 12) + '…' : s;
}

function renderTextLane() {
  const lane = $('#laneTexts');
  const total = totalDur();
  if (!total) { lane.innerHTML = ''; lane.style.height = ''; return; }
  const items = S.texts.slice().sort((a, b) => a.start - b.start);
  const rowEnds = [];
  items.forEach(t => {
    let r = 0;
    while (rowEnds[r] !== undefined && rowEnds[r] > t.start + 0.05) r++;
    rowEnds[r] = t.end;
    t._row = r;
  });
  const rowH = 20;
  lane.style.height = (Math.max(1, rowEnds.length) * rowH + 2) + 'px';
  lane.innerHTML = items.map(t => {
    const left = clamp(t.start / total, 0, 1) * 100;
    const w = Math.max(0.8, ((t.end - t.start) / total) * 100);
    const label = (t.text || '').split('\n')[0].slice(0, 14);
    return `<div class="txblk ${S.selText === t.id ? 'sel' : ''}" data-id="${t.id}" style="left:${left}%;width:${w}%;top:${t._row * rowH + 2}px" title="${escapeHtml(String(t.text || '').replace(/\n/g, ' '))}">${escapeHtml(label)}</div>`;
  }).join('');
}

function updatePlayhead() {
  const total = totalDur();
  const ph = $('#playhead');
  ph.style.left = (total ? clamp(S.t / total, 0, 1) * 100 : 0) + '%';
  ph.style.display = S.clips.length ? 'block' : 'none';
}

$('#laneClips').addEventListener('click', e => {
  const b = e.target.closest('.clipblk');
  if (b) { S.selClip = b.dataset.id; renderClipList(); renderTimeline(); }
});
$('#laneTexts').addEventListener('click', e => {
  const b = e.target.closest('.txblk');
  if (b) { S.selText = b.dataset.id; renderTextList(); syncEditor(); renderTextLane(); draw(S.t); switchTab('texts'); }
  e.stopPropagation();
});

(function initScrub() {
  const lanes = $('#tlLanes');
  let dragging = false;
  const setFromEvent = e => {
    const r = lanes.getBoundingClientRect();
    const x = clamp((e.clientX - r.left) / r.width, 0, 1);
    seekTo(x * totalDur(), S.playing);
  };
  lanes.addEventListener('pointerdown', e => {
    if (!S.clips.length) return;
    if (e.target.closest('.txblk')) return;
    dragging = true;
    lanes.setPointerCapture(e.pointerId);
    setFromEvent(e);
  });
  lanes.addEventListener('pointermove', e => { if (dragging) setFromEvent(e); });
  lanes.addEventListener('pointerup', e => { dragging = false; try { lanes.releasePointerCapture(e.pointerId); } catch (err) { } });
  lanes.addEventListener('pointercancel', () => { dragging = false; });
})();

$('#zoomIn').onclick = () => { S.zoom = clamp(S.zoom * 1.5, 1, 8); applyZoom(); };
$('#zoomOut').onclick = () => { S.zoom = clamp(S.zoom / 1.5, 1, 8); applyZoom(); };
function applyZoom() {
  $('#tlLanes').style.width = (S.zoom * 100) + '%';
}

/* ---------------------------------------------------------
   캔버스 조작 (자막 드래그)
--------------------------------------------------------- */
function toCanvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
function hitTest(p) {
  for (let i = S.texts.length - 1; i >= 0; i--) {
    const it = S.texts[i];
    if (!it._box) continue;
    if (S.t + 0.001 < it.start || S.t >= it.end) continue;
    const b = it._box;
    if (p.x >= b.x - 8 && p.x <= b.x + b.w + 8 && p.y >= b.y - 8 && p.y <= b.y + b.h + 8) return it;
  }
  return null;
}

let drag = null;
canvas.addEventListener('pointerdown', e => {
  if (S.exporting) return;
  const p = toCanvasPoint(e);
  const it = hitTest(p);
  if (it) {
    S.selText = it.id;
    renderTextList(); syncEditor(); draw(S.t);
    drag = { id: it.id, dx: p.x - it.x * W, dy: p.y - it.y * H };
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  } else {
    if (S.selText) { S.selText = null; renderTextList(); syncEditor(); draw(S.t); }
  }
});
canvas.addEventListener('pointermove', e => {
  if (!drag) return;
  const it = S.texts.find(t => t.id === drag.id);
  if (!it) return;
  const p = toCanvasPoint(e);
  it.x = clamp((p.x - drag.dx) / W, 0.02, 0.98);
  it.y = clamp((p.y - drag.dy) / H, 0.02, 0.98);
  if (Math.abs(it.x - 0.5) < 0.015) it.x = 0.5;
  draw(S.t);
  const xs = $('#textEditor [data-k="x"]'), ys = $('#textEditor [data-k="y"]');
  if (xs) xs.value = it.x;
  if (ys) ys.value = it.y;
  updateValLabels();
});
canvas.addEventListener('pointerup', e => { if (drag) { drag = null; try { canvas.releasePointerCapture(e.pointerId); } catch (err) { } renderTextLane(); } });
canvas.addEventListener('pointercancel', () => { drag = null; });

/* ---------------------------------------------------------
   상단/재생 컨트롤
--------------------------------------------------------- */
$('#btnPlay').onclick = () => { S.playing ? pause() : play(); };
$('#seek').addEventListener('input', e => {
  const total = totalDur();
  if (!total) return;
  const wasPlaying = S.playing;
  S.t = (+e.target.value / 1000) * total;
  pauseAllVideos(null);
  if (S.clips.length) enterClipAt(S.t, wasPlaying);
  draw(S.t);
  updateTimeUI();
});
$('#seek').addEventListener('change', () => { if (S.playing) enterClipAt(S.t, true); });

$('#btnMute').onclick = () => {
  S.muted = !S.muted;
  $('#btnMute').textContent = S.muted ? '🔇' : '🔊';
  S.clips.forEach(c => { if (c.kind === 'video') c.el.muted = S.muted; if (c._gain) c._gain.gain.value = S.muted ? 0 : (c.volume || 1); });
};

$('#btnGuides').onclick = () => {
  S.guides = !S.guides;
  $('#btnGuides').classList.toggle('on', S.guides);
  draw(S.t);
};

$('#btnReset').onclick = () => {
  if (!S.clips.length && !S.texts.length) return;
  if (!confirm('모든 클립과 자막을 지우고 처음 상태로 돌아갈까요?')) return;
  pause();
  S.clips.forEach(disposeClip);
  S.clips = []; S.texts = []; S.selClip = null; S.selText = null; S.t = 0;
  renderAll();
  toast('초기화했습니다.');
};

$('#fileInput').addEventListener('change', async e => {
  const files = Array.from(e.target.files || []);
  e.target.value = '';
  if (!files.length) return;
  toast(`${files.length}개 불러오는 중...`, 1500);
  for (const f of files) {
    const c = await makeClipFromFile(f);
    if (c) { S.clips.push(c); S.selClip = c.id; }
  }
  renderAll();
  toast('클립을 추가했습니다.');
});

$('#addColor').onclick = () => addColorClip(false);
$('#addGrad').onclick = () => addColorClip(true);

/* ---------------------------------------------------------
   탭
--------------------------------------------------------- */
function switchTab(name) {
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  $$('.panel').forEach(p => p.classList.toggle('on', p.dataset.panel === name));
  if (name === 'export') updateExportSummary();
}
$('#tabs').addEventListener('click', e => {
  const b = e.target.closest('button[data-tab]');
  if (b) switchTab(b.dataset.tab);
});

/* ---------------------------------------------------------
   프리셋
--------------------------------------------------------- */
const BADGE_BASE = {
  font: FONT_LIST[1], weight: 900, size: 52, color: '#ffffff', x: 0.5, y: 0.135,
  align: 'center', lineHeight: 1.1, maxW: 0.9,
  bg: { on: true, color: '#ff2d55', alpha: 1, radius: 70, padX: 34 },
  stroke: { color: '#000000', width: 0 },
  shadow: { on: true, color: '#000000', blur: 18, x: 0, y: 6 }
};

function presetClips(kind) {
  const sets = {
    qupas: [
      { color: '#1b0710', color2: '#ff2d55' },
      { color: '#071120', color2: '#2f6bff' },
      { color: '#0b0d12', color2: '#3a1030' }
    ],
    dangn: [
      { color: '#120d05', color2: '#4a3200' },
      { color: '#0b0f0d', color2: '#1f4a34' },
      { color: '#0b0c12', color2: '#2a1a3a' }
    ]
  };
  return (sets[kind] || sets.qupas).map((s, i) => ({
    id: uid(), kind: 'color', name: `${i + 1}번 배경`, grad: true, dir: 'd',
    color: s.color, color2: s.color2, dur: 3.5, trimStart: 0, trimEnd: 3.5, volume: 1
  }));
}

function qupasTexts(total) {
  const T = total;
  const seg = T / 3;
  return [
    newText({ ...BADGE_BASE, text: '쿠파스 최저가', start: 0, end: T, size: 54 }),
    newText({
      text: "이거 사기 전에\n쿠파스 먼저 봄", start: 0, end: seg + 0.4, y: 0.36,
      font: FONT_LIST[1], size: 104, weight: 900, lineHeight: 1.14,
      stroke: { color: '#000000', width: 8 },
      shadow: { on: true, color: '#000000', blur: 24, x: 0, y: 8 }
    }),
    newText({
      text: "같은 제품인데\n가격 30% 차이남", start: seg + 0.2, end: seg * 2 + 0.4, y: 0.36,
      font: FONT_LIST[1], size: 96, weight: 900, lineHeight: 1.16, color: '#ffffff',
      stroke: { color: '#000000', width: 8 },
      shadow: { on: true, color: '#000000', blur: 24, x: 0, y: 8 }
    }),
    newText({
      text: "상품명만 넣으면\n최저가 바로 나옴", start: seg * 2 + 0.2, end: T, y: 0.36,
      font: FONT_LIST[1], size: 92, weight: 900, lineHeight: 1.16, color: '#ffd23f',
      stroke: { color: '#000000', width: 8 },
      shadow: { on: true, color: '#000000', blur: 24, x: 0, y: 8 }
    }),
    newText({
      text: "댓글에 '링크' 남기면\n최저가 바로 보내드림", start: 0, end: T, y: 0.80,
      font: FONT_LIST[0], size: 50, weight: 800, lineHeight: 1.3, color: '#ffffff',
      bg: { on: true, color: '#000000', alpha: 0.62, radius: 22, padX: 26 },
      stroke: { color: '#000000', width: 0 },
      shadow: { on: true, color: '#000000', blur: 12, x: 0, y: 4 }
    })
  ];
}

function dangnTexts(total) {
  const T = total;
  const seg = T / 3;
  return [
    newText({
      ...BADGE_BASE, text: '당근 부업', start: 0, end: T,
      bg: { on: true, color: '#ffd23f', alpha: 1, radius: 70, padX: 34 },
      color: '#141200'
    }),
    newText({
      text: "월급만으로는\n답 없음", start: 0, end: seg + 0.4, y: 0.4,
      font: FONT_LIST[1], size: 116, weight: 900, lineHeight: 1.12,
      stroke: { color: '#000000', width: 8 },
      shadow: { on: true, color: '#000000', blur: 24, x: 0, y: 8 }
    }),
    newText({
      text: "당근 카페 하나로\n월 300 만든 방법", start: seg + 0.2, end: seg * 2 + 0.4, y: 0.4,
      font: FONT_LIST[1], size: 92, weight: 900, lineHeight: 1.18, color: '#ffd23f',
      stroke: { color: '#000000', width: 8 },
      shadow: { on: true, color: '#000000', blur: 24, x: 0, y: 8 }
    }),
    newText({
      text: "어렵게 시작하면\n3일도 못 감", start: seg * 2 + 0.2, end: T, y: 0.4,
      font: FONT_LIST[1], size: 100, weight: 900, lineHeight: 1.16,
      stroke: { color: '#000000', width: 8 },
      shadow: { on: true, color: '#000000', blur: 24, x: 0, y: 8 }
    }),
    newText({
      text: "프로필 링크에\n순서 정리해둠", start: 0, end: T, y: 0.80,
      font: FONT_LIST[0], size: 52, weight: 800, lineHeight: 1.3,
      bg: { on: true, color: '#000000', alpha: 0.62, radius: 22, padX: 26 },
      stroke: { color: '#000000', width: 0 },
      shadow: { on: true, color: '#000000', blur: 12, x: 0, y: 4 }
    })
  ];
}

function applyPreset(kind) {
  const hadTexts = S.texts.length > 0;
  if (hadTexts && !confirm('지금 자막을 프리셋 자막으로 교체할까요?')) return;
  pause();
  if (!S.clips.length) {
    presetClips(kind).forEach(c => { S.clips.push(c); });
  }
  const total = Math.max(totalDur(), 6);
  S.texts = kind === 'dangn' ? dangnTexts(total) : qupasTexts(total);
  S.selText = S.texts[0]?.id || null;
  S.selClip = S.clips[0]?.id || null;
  S.t = 0;
  renderAll();
  switchTab('texts');
  toast(S.clips.length ? '프리셋 적용 완료 · 자막을 눌러 수정하세요' : '', 1800);
}

$$('.preset').forEach(b => b.onclick = () => applyPreset(b.dataset.preset));

/* ---------------------------------------------------------
   내보내기 (MediaRecorder)
--------------------------------------------------------- */
let actx = null, audioDest = null;

function ensureAudioGraph() {
  try {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      actx = new AC();
      audioDest = actx.createMediaStreamDestination();
      // 무음 소스를 계속 흘려보낸다: 오디오 트랙이 비면 일부 브라우저에서 MP4에
      // 프레임이 앞부분만 담기는 문제가 있어 항상 오디오 데이터가 있게 한다.
      try {
        const silence = actx.createConstantSource();
        silence.offset.value = 0;
        const g = actx.createGain();
        g.gain.value = 0;
        silence.connect(g);
        g.connect(audioDest);
        silence.start();
        window.__silence = silence;
      } catch (e) { }
    }
    if (actx.state === 'suspended') actx.resume();
    for (const c of S.clips) {
      if (c.kind !== 'video' || c._src) continue;
      try {
        c._src = actx.createMediaElementSource(c.el);
        c._gain = actx.createGain();
        c._gain.gain.value = S.muted ? 0 : (c.volume == null ? 1 : c.volume);
        c._src.connect(c._gain);
        c._gain.connect(actx.destination);
      } catch (e) { /* 이미 연결된 경우 무시 */ }
    }
    return true;
  } catch (e) { return false; }
}

function routeToDest(on) {
  if (!audioDest) return;
  for (const c of S.clips) {
    if (!c._gain) continue;
    try { on ? c._gain.connect(audioDest) : c._gain.disconnect(audioDest); } catch (e) { }
  }
}

function pickMime(pref) {
  const list = [];
  if (pref === 'mp4') list.push('video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4');
  else if (pref === 'webm') list.push('video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm');
  else list.push('video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm');
  if (!window.MediaRecorder) return '';
  for (const m of list) {
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) { }
  }
  return '';
}

async function prepVideos() {
  const jobs = [];
  for (const c of S.clips) {
    if (c.kind !== 'video') continue;
    const v = c.el;
    jobs.push(new Promise(res => {
      if (v.readyState >= 2 && Math.abs(v.currentTime - c.trimStart) < 0.08) return res();
      let done = false;
      const fin = () => { if (done) return; done = true; v.removeEventListener('seeked', fin); res(); };
      v.addEventListener('seeked', fin);
      try { v.currentTime = c.trimStart; } catch (e) { fin(); }
      setTimeout(fin, 900);
    }));
  }
  await Promise.all(jobs);
}

function updateExportSummary() {
  const total = totalDur();
  const w = S.res, h = Math.round(w * 16 / 9);
  const mime = pickMime(S.fmt);
  const fmtLabel = mime.includes('mp4') ? 'MP4' : mime.includes('webm') ? 'WebM' : '지원 안 됨';
  const fps = S.fps;
  const bps = (S.res === 1080 ? 6200000 : 3200000) * (fps >= 60 ? 1.7 : 1);
  const est = total ? (bps / 8) * total : 0;
  $('#expSum').innerHTML = `
    <div><span class="k">길이</span> <b>${fmtTime(total)}</b> <span class="k">(${S.clips.length}컷 · 자막 ${S.texts.length}개)</span></div>
    <div><span class="k">해상도</span> <b>${w}×${h}</b> <span class="k">· ${fps}fps · ${fmtLabel}</span></div>
    <div><span class="k">예상 최대 용량</span> <b>약 ${fmtSize(est)}</b></div>
    ${!mime ? '<div class="warn">이 브라우저는 영상 녹화를 지원하지 않습니다. Chrome 또는 Safari 최신 버전을 사용해 주세요.</div>' : ''}
    ${mime && !mime.includes('mp4') ? '<div class="warn">이 브라우저는 MP4 녹화를 지원하지 않아 WebM으로 저장됩니다. 아이폰에서는 재생이 안 될 수 있습니다.</div>' : ''}
    ${total === 0 ? '<div class="warn">클립을 먼저 추가하세요.</div>' : ''}
  `;
}

function setProgress(pct, sub) {
  $('#exBar').style.width = clamp(pct, 0, 100) + '%';
  $('#exSub').textContent = sub != null ? sub : Math.round(clamp(pct, 0, 100)) + '%';
}
function updateExportProgress() {
  const total = totalDur();
  if (!total) return;
  const pct = clamp(S.t / total, 0, 1);
  setProgress(pct * 100, `${Math.round(pct * 100)}% · ${fmtTime(S.t)} / ${fmtTime(total)}`);
}

async function startExport() {
  if (S.exporting) return;
  if (!S.clips.length) { toast('클립을 먼저 추가하세요.'); switchTab('clips'); return; }
  const total = totalDur();
  if (total < 0.5) { toast('영상 길이가 너무 짧습니다.'); return; }

  if (total > 180 && !confirm(`영상 길이가 ${fmtTime(total)}입니다. 그만큼 실시간으로 녹화됩니다. 계속할까요?`)) return;

  const mime = pickMime(S.fmt);
  if (!mime) {
    toast('이 브라우저에서는 영상 녹화를 지원하지 않습니다. Chrome/Safari 최신 버전을 사용해 주세요.', 4200);
    return;
  }

  // 사용자 제스처 안에서 오디오 그래프 준비
  ensureAudioGraph();
  await document.fonts.ready.catch(() => { });
  pause();
  S.t = 0;
  S.muted = false; $('#btnMute').textContent = '🔊';
  S.clips.forEach(c => { if (c.kind === 'video') c.el.muted = false; });
  S.exporting = true;
  EXPORT.cancel = false;
  EXPORT.chunks = [];
  document.body.classList.add('busy');

  // 보이는 캔버스를 내보내기 해상도로 바꿔 그대로 캡처한다
  // (DOM에 붙지 않은 캔버스는 프레임 공급이 멈추는 브라우저가 있음)
  const w = S.res, h = Math.round(w * 16 / 9);
  EXPORT.w = w; EXPORT.h = h;
  EXPORT.scale = w / W;
  canvas.width = w; canvas.height = h;

  showOverlay(true);
  setProgress(0, '준비 중...');

  await prepVideos();
  draw(0);

  const vStream = canvas.captureStream(S.fps);
  const tracks = [...vStream.getVideoTracks()];
  if (audioDest && audioDest.stream.getAudioTracks().length) {
    tracks.push(...audioDest.stream.getAudioTracks());
  }
  const stream = new MediaStream(tracks);

  let rec;
  try {
    rec = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: (S.res === 1080 ? 6200000 : 3200000) * (S.fps >= 60 ? 1.7 : 1)
    });
  } catch (e) {
    try { rec = new MediaRecorder(stream); } catch (e2) {
      cleanupExport();
      toast('녹화를 시작할 수 없습니다: ' + (e2.message || e2.name), 4200);
      return;
    }
  }
  EXPORT.rec = rec;
  rec.ondataavailable = ev => { if (ev.data && ev.data.size) EXPORT.chunks.push(ev.data); };
  const stopped = new Promise(res => { rec.onstop = res; });

  rec.start(400);
  routeToDest(true);

  await new Promise(res => { EXPORT.resolve = res; play(true); });

  setProgress(100, '마무리 중...');
  await wait(220);
  try { if (rec.state !== 'inactive') rec.stop(); } catch (e) { }
  await stopped;
  routeToDest(false);
  vStream.getVideoTracks().forEach(t => t.stop());

  const cancelled = EXPORT.cancel;
  cleanupExport();

  if (cancelled) { toast('내보내기를 취소했습니다.'); return; }
  if (!EXPORT.chunks.length) { toast('녹화된 데이터가 없습니다. 다시 시도해 주세요.', 3600); return; }

  const blob = new Blob(EXPORT.chunks, { type: mime });
  EXPORT.chunks = [];
  await showResult(blob, mime);
}

function cleanupExport() {
  S.exporting = false;
  EXPORT.rec = null; EXPORT.resolve = null; EXPORT.scale = 1;
  canvas.width = W; canvas.height = H;
  fitCanvas();
  draw(S.t);
  document.body.classList.remove('busy');
  showOverlay(false);
}

function showOverlay(on) {
  $('#exportOverlay').classList.toggle('hidden', !on);
}

async function inspectCodec(blob, ext) {
  try {
    const head = new Uint8Array(await blob.slice(0, Math.min(blob.size, 3_000_000)).arrayBuffer());
    let s = '';
    for (let i = 0; i < head.length; i += 0x8000) s += String.fromCharCode.apply(null, head.subarray(i, i + 0x8000));
    if (ext === 'mp4') return { h264: s.includes('avc1') || s.includes('avc3'), aac: s.includes('mp4a'), vp9: s.includes('vp09') || s.includes('vp08') };
    return { vp9: s.includes('V_VP9') || s.includes('V_VP8'), opus: s.includes('Opus') || s.includes('opus') };
  } catch (e) { return {}; }
}

async function showResult(blob, mime) {
  const ext = mime.includes('mp4') ? 'mp4' : 'webm';
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const name = `reels_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.${ext}`;
  if (EXPORT.blobUrl) URL.revokeObjectURL(EXPORT.blobUrl);
  EXPORT.blobUrl = URL.createObjectURL(blob);
  const codec = await inspectCodec(blob, ext);
  const box = $('#expResult');
  box.classList.remove('hidden');

  let warn = '';
  if (ext === 'mp4' && codec.h264 === false) {
    warn = `<div class="warnline">이 브라우저는 H.264 인코더가 없어 MP4 안에 VP9로 저장됐습니다. 인스타 업로드가 안 될 수 있으니 <b>Chrome(PC)</b> 또는 <b>아이폰 Safari</b>에서 다시 내보내 주세요.</div>`;
  } else if (ext === 'webm') {
    warn = `<div class="warnline">WebM은 인스타 릴스 업로드가 안 될 수 있습니다. MP4(H.264)로 다시 내보내려면 Chrome(PC)이나 아이폰 Safari를 쓰세요.</div>`;
  }

  box.innerHTML = `
    <b>완성! ${fmtTime(totalDur())} · ${fmtSize(blob.size)} · ${ext.toUpperCase()}${codec.h264 ? ' (H.264)' : ''}</b>
    <video src="${EXPORT.blobUrl}" controls playsinline preload="metadata"></video>
    <a href="${EXPORT.blobUrl}" download="${name}">⬇ ${name} 내려받기</a>
    <small>내려받은 파일을 인스타그램 앱에서 릴스로 업로드하세요.<br>아이폰은 사진 앱에 저장한 뒤 업로드하면 됩니다.</small>
    ${warn}
  `;
  toast('영상이 완성됐습니다. 내려받기 버튼을 누르세요.', 3600);
}

$('#btnExport').onclick = startExport;
$('#btnExportTop').onclick = () => { switchTab('export'); startExport(); };
$('#exCancel').onclick = () => { EXPORT.cancel = true; };

$('#resSeg').addEventListener('click', e => {
  const b = e.target.closest('button[data-res]');
  if (!b) return;
  S.res = +b.dataset.res;
  $$('#resSeg button').forEach(x => x.classList.toggle('on', x === b));
  updateExportSummary();
});
$('#fpsSel').addEventListener('change', e => { S.fps = +e.target.value; updateExportSummary(); });
$('#fmtSel').addEventListener('change', e => { S.fmt = e.target.value; updateExportSummary(); });

/* ---------------------------------------------------------
   캔버스 표시 크기 / 리사이즈
--------------------------------------------------------- */
function fitCanvas() {
  const wrap = $('#canvasWrap');
  if (!wrap) return;
  const aw = wrap.clientWidth, ah = wrap.clientHeight;
  if (!aw || !ah) return;
  let h = ah, w = h * 9 / 16;
  if (w > aw) { w = aw; h = w * 16 / 9; }
  canvas.style.width = Math.round(w) + 'px';
  canvas.style.height = Math.round(h) + 'px';
  canvas.style.maxWidth = '100%';
}
window.addEventListener('resize', fitCanvas);
if (window.ResizeObserver) new ResizeObserver(fitCanvas).observe($('#canvasWrap'));

/* ---------------------------------------------------------
   초기화
--------------------------------------------------------- */
function renderAll() {
  renderClipList();
  renderTextList();
  renderTimeline();
  syncEditor();
  updateExportSummary();
  draw(S.t);
  updateTimeUI();
}

async function loadFonts() {
  const tasks = FONT_LIST.map(f => document.fonts.load(`900 64px ${f}`, '가나다라마바사ABC123').catch(() => { }));
  tasks.push(document.fonts.load(`700 64px ${FONT_LIST[0]}`, '가나다ABC').catch(() => { }));
  await Promise.all(tasks);
  draw(S.t);
}

document.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  if (e.code === 'Space') { e.preventDefault(); S.playing ? pause() : play(); }
  else if (e.code === 'ArrowRight') { e.preventDefault(); seekTo(S.t + 0.2, S.playing); }
  else if (e.code === 'ArrowLeft') { e.preventDefault(); seekTo(S.t - 0.2, S.playing); }
  else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (S.selText) { e.preventDefault(); removeText(S.selText); }
  }
});

window.addEventListener('beforeunload', e => {
  if (S.exporting) { e.preventDefault(); e.returnValue = ''; }
});

// 시작
(function init() {
  applyZoom();
  fitCanvas();
  draw(0);
  updateTimeUI();
  updateExportSummary();
  loadFonts();
  S.ready = true;
  setTimeout(fitCanvas, 120);
})();
