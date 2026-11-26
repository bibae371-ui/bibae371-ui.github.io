/* 당버지 AI 오피스 — 픽셀아트 현황판
 * 데이터는 ./data.json 만 고치면 반영된다. (5분마다 자동 재조회)
 *
 * 그리기 구조: back(방·바닥·벽·소품) → 봇 → front(책상·모니터·탁자) → 효과
 * 봇이 책상 뒤에 앉은 것처럼 보이도록 테이블류는 front 레이어에 그린다.
 */
(function () {
  'use strict';

  var VW = 180, VH = 232;
  var $ = function (s) { return document.querySelector(s); };

  /* ---------------------------------------------------------------- 방 배치 */
  var ROOMS = {
    ceo:      { x: 3,   y: 3,   w: 78, h: 49, kind: 'ceo',    side: 'L' },
    meet:     { x: 99,  y: 3,   w: 78, h: 49, kind: 'meet',   side: 'R' },
    economy:  { x: 3,   y: 55,  w: 78, h: 34, kind: 'dept',   side: 'L' },
    health:   { x: 3,   y: 89,  w: 78, h: 35, kind: 'dept',   side: 'L' },
    dayeon:   { x: 3,   y: 124, w: 78, h: 34, kind: 'dept',   side: 'L' },
    global:   { x: 3,   y: 158, w: 78, h: 35, kind: 'dept',   side: 'L' },
    local:    { x: 99,  y: 55,  w: 78, h: 46, kind: 'dept',   side: 'R' },
    finance:  { x: 99,  y: 101, w: 78, h: 46, kind: 'dept',   side: 'R' },
    webtools: { x: 99,  y: 147, w: 78, h: 46, kind: 'dept',   side: 'R' },
    pantry:   { x: 3,   y: 196, w: 174, h: 33, kind: 'pantry', side: 'B' }
  };
  var CORR_X = 90;

  var SHIRTS = {
    economy: '#3ce0ff', health: '#4ade80', dayeon: '#ff7ba9', global: '#a78bfa',
    local: '#ffd166', finance: '#fb923c', webtools: '#94a3b8'
  };
  var HAIRS = {
    economy: '#241a14', health: '#2b2018', dayeon: '#3a2233', global: '#1d2a26',
    local: '#33261a', finance: '#201a2c', webtools: '#1f2733'
  };
  var SKINS = ['#f2c69b', '#e8ba8f', '#f7d3ae', '#dcab80'];

  /* ---------------------------------------------------------------- 상태 */
  var DATA = null, S = 1;
  var canvas, ctx, backCv, bctx, frontCv, fctx;
  var bots = [], effects = [], trayPapers = 0, stampT = 0, stampFlash = 0;
  var selected = null, last = 0, deptList = [];

  /* ================================================================ 유틸 */
  function R(g, x, y, w, h, c) {
    var x0 = Math.round(x * S), y0 = Math.round(y * S);
    var x1 = Math.round((x + w) * S), y1 = Math.round((y + h) * S);
    if (x1 <= x0 || y1 <= y0) return;
    g.fillStyle = c; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* ---------------------------------------------------------------- 문/경로 */
  function doorOf(key) {
    var r = ROOMS[key];
    if (r.kind === 'pantry') return { ix: CORR_X, iy: 200, cx: CORR_X };
    var y = r.y + r.h - 9;
    if (r.side === 'L') return { ix: r.x + r.w - 5, iy: y, cx: CORR_X };
    return { ix: r.x + 5, iy: y, cx: CORR_X };
  }
  function exitPath(key, from) {
    var d = doorOf(key), p = [];
    if (key === 'pantry') {
      p.push({ x: from.x, y: 206 }); p.push({ x: CORR_X, y: 206 }); p.push({ x: CORR_X, y: d.iy });
    } else {
      p.push({ x: from.x, y: d.iy }); p.push({ x: d.ix, y: d.iy }); p.push({ x: CORR_X, y: d.iy });
    }
    return p;
  }
  function enterPath(key, to) {
    var d = doorOf(key), p = [];
    if (key === 'pantry') {
      p.push({ x: CORR_X, y: d.iy }); p.push({ x: CORR_X, y: 206 }); p.push({ x: to.x, y: 206 }); p.push({ x: to.x, y: to.y });
    } else {
      p.push({ x: CORR_X, y: d.iy }); p.push({ x: d.ix, y: d.iy }); p.push({ x: to.x, y: d.iy }); p.push({ x: to.x, y: to.y });
    }
    return p;
  }

  /* ================================================================ 캔버스 */
  function layout() {
    var holder = $('#holder');
    var w = holder.clientWidth || 360;
    var maxH = Math.max(380, (window.innerHeight || 800) * 0.76);
    var cssW = Math.max(260, Math.min(w, maxH * VW / VH));
    var cssH = cssW * VH / VW;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    holder.style.height = cssH + 'px';

    S = canvas.width / VW;
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    backCv = document.createElement('canvas');
    backCv.width = canvas.width; backCv.height = canvas.height;
    bctx = backCv.getContext('2d'); bctx.imageSmoothingEnabled = false;

    frontCv = document.createElement('canvas');
    frontCv.width = canvas.width; frontCv.height = canvas.height;
    fctx = frontCv.getContext('2d'); fctx.imageSmoothingEnabled = false;

    buildBack();
    buildFront();
    try { paint(performance.now()); } catch (e) { }

    var tagFs = Math.max(7.5, Math.min(12.5, cssW / 180 * 4.5));
    var bubFs = Math.max(7, Math.min(11.5, cssW / 180 * 4.1));
    holder.style.setProperty('--fs-tag', tagFs.toFixed(1) + 'px');
    holder.style.setProperty('--fs-bub', bubFs.toFixed(1) + 'px');
  }

  /* ================================================================ BACK */
  function buildBack() {
    var g = bctx;
    R(g, 0, 0, VW, VH, '#070a14');
    R(g, 0, 0, VW, VH, '#0a1020');
    R(g, 1.5, 1.5, VW - 3, VH - 3, '#0d1526');
    R(g, 2.5, 2.5, VW - 5, VH - 5, '#070a14');
    R(g, 0.6, 0.6, VW - 1.2, 0.8, '#1d3050');
    R(g, 0.6, VH - 1.4, VW - 1.2, 0.8, '#1d3050');
    R(g, 0.6, 0.6, 0.8, VH - 1.2, '#1d3050');
    R(g, VW - 1.4, 0.6, 0.8, VH - 1.2, '#1d3050');

    drawCorridor(g);
    drawCeoRoom(g);
    drawMeetingRoom(g);
    var keys = ['economy', 'health', 'dayeon', 'global', 'local', 'finance', 'webtools'];
    for (var i = 0; i < keys.length; i++) drawDeptRoom(g, ROOMS[keys[i]], keys[i], i);
    drawPantry(g);

    // 층 벽
    wallBand(g, 3, 52, 174, 3);
    wallBand(g, 3, 193, 81, 3);
    wallBand(g, 99, 193, 78, 3);
    wallVert(g, 81, 3, 3, 193);
    wallVert(g, 96, 3, 3, 193);

    // 문
    doorGap(g, 'L', ROOMS.ceo);
    doorGap(g, 'R', ROOMS.meet);
    for (var k = 0; k < keys.length; k++) doorGap(g, ROOMS[keys[k]].side, ROOMS[keys[k]]);
    R(g, CORR_X - 6, 193, 12, 3, '#080d18');
    R(g, CORR_X - 5, 194, 10, 0.8, 'rgba(255,214,140,.16)');
  }

  function wallBand(g, x, y, w, h) {
    R(g, x, y, w, h, '#0d1526');
    R(g, x, y, w, 0.8, '#243554');
    R(g, x, y + h - 0.7, w, 0.7, '#060a14');
  }
  function wallVert(g, x, y, w, h) {
    R(g, x, y, w, h, '#0d1526');
    R(g, x, y, 0.8, h, '#243554');
    R(g, x + w - 0.7, y, 0.7, h, '#060a14');
  }
  function doorGap(g, side, r) {
    var y = r.y + r.h - 9;
    if (side === 'L') {
      R(g, r.x + r.w, y - 4, 3, 8, '#060a14');
      R(g, r.x + r.w, y - 4, 3, 0.8, 'rgba(120,170,255,.10)');
      R(g, r.x + r.w + 1, y - 4, 2, 8, 'rgba(255,206,120,.05)');
      R(g, r.x + r.w - 0.6, y - 4.6, 0.8, 9.2, '#2c3d5e');
    } else {
      R(g, r.x - 3, y - 4, 3, 8, '#060a14');
      R(g, r.x - 3, y - 4, 3, 0.8, 'rgba(120,170,255,.10)');
      R(g, r.x - 3, y - 4, 2, 8, 'rgba(255,206,120,.05)');
      R(g, r.x + 2.8, y - 4.6, 0.8, 9.2, '#2c3d5e');
    }
  }

  /* ---------------------------------------------------------------- 복도 */
  function drawCorridor(g) {
    var x = CORR_X - 6, w = 12, y = 3, h = 193;
    R(g, x, y, w, h, '#101a2c');
    // 바닥 타일 세로줄
    for (var yy = y; yy < y + h; yy += 7) R(g, x, yy, w, 0.5, 'rgba(255,255,255,.035)');
    // 러너 카펫
    R(g, x + 1.6, y, 8.8, h, '#16223a');
    R(g, x + 1.6, y, 0.7, h, 'rgba(60,224,255,.16)');
    R(g, x + 9.7, y, 0.7, h, 'rgba(60,224,255,.10)');
    for (var d = y + 2; d < y + h; d += 7) R(g, x + 2.6, d, 6.8, 2.6, 'rgba(60,224,255,.045)');
    // 조명등 + 빛 웅덩이
    for (var ly = 14; ly < 186; ly += 30) {
      R(g, x + 2.4, ly, 7.2, 1.2, 'rgba(255,236,190,.7)');
      R(g, x + 1.2, ly - 2, 9.6, 5, 'rgba(255,214,140,.05)');
      R(g, x + 2, ly + 1.2, 8, 6, 'rgba(255,214,140,.028)');
    }
    // 엘리베이터
    R(g, x + 1, 6, 10, 17, '#1a2438');
    R(g, x + 1.6, 6.6, 8.8, 15.6, '#0b1220');
    R(g, x + 5.7, 6.6, 0.6, 15.6, '#26344e');
    R(g, x + 2.6, 4.6, 6.8, 1.6, '#0b1220');
    R(g, x + 3.6, 4.9, 1.2, 1, '#ff8a5c');
    R(g, x + 6, 4.9, 1.2, 1, '#3ce0ff');
    R(g, x + 1, 6, 10, 0.6, '#2b3b5e');
    // 소화기 / 안내판
    R(g, x + 1.2, 96, 1.8, 4, '#c0392b');
    R(g, x + 1.2, 95.4, 1.8, 0.8, '#8e2a20');
    R(g, x + 9.4, 130, 1.6, 5, '#3a4a68');
    // 3F 표찰
    R(g, x + 1, 168, 10, 8, '#0b1424');
    R(g, x + 1.6, 168.6, 8.8, 6.8, '#16233c');
    R(g, x + 2.6, 170, 1.4, 3.6, '#8fb6d8');
    R(g, x + 4.6, 170, 1.4, 3.6, '#8fb6d8');
    R(g, x + 6.6, 170.4, 1.4, 3, '#4ade80');
    R(g, x + 8, 170.6, 0.8, 2.4, '#ffd166');
  }

  /* ---------------------------------------------------------------- 방 공통 */
  function roomBase(g, r, wallH, wallColor, floorColor, plankAlpha) {
    R(g, r.x, r.y, r.w, r.h, wallColor);
    for (var x = r.x + 6; x < r.x + r.w - 2; x += 8) {
      R(g, x, r.y + 1, 0.7, wallH - 1.2, 'rgba(0,0,0,.20)');
      R(g, x + 0.7, r.y + 1, 0.5, wallH - 1.2, 'rgba(255,255,255,.028)');
    }
    R(g, r.x, r.y, r.w, 0.9, 'rgba(150,190,255,.10)');
    R(g, r.x, r.y + wallH, r.w, r.h - wallH, floorColor);
    for (var yy = r.y + wallH; yy < r.y + r.h; yy += 2.6) {
      R(g, r.x, yy, r.w, 0.45, 'rgba(0,0,0,' + (plankAlpha || 0.16) + ')');
    }
    R(g, r.x, r.y + wallH - 1.3, r.w, 1.3, '#0a1120');
    R(g, r.x, r.y + wallH, r.w, 0.55, 'rgba(255,255,255,.06)');
  }

  function plant(g, x, y, s) {
    s = s || 1;
    R(g, x, y + 4, 5 * s, 3.4, '#6b4a33');
    R(g, x, y + 4, 5 * s, 0.8, '#94704d');
    R(g, x + 1 * s, y + 0.6, 3 * s, 3.8, '#2f7d4f');
    R(g, x + 0.2 * s, y + 1.6, 1.6 * s, 2.4, '#39a066');
    R(g, x + 3.6 * s, y + 1, 1.6 * s, 2.6, '#39a066');
    R(g, x + 2 * s, y - 0.6, 1.6 * s, 1.8, '#4bbd7a');
  }

  function windowPanel(g, x, y, w, h) {
    R(g, x - 1.6, y - 1.6, w + 3.2, h + 3.2, '#2c3c5c');
    R(g, x - 0.8, y - 0.8, w + 1.6, h + 1.6, '#3d5178');
    R(g, x, y, w, h, '#101f45');
    R(g, x, y, w, h * 0.55, '#16295a');
    // 별/도시
    R(g, x + 2.6, y + 2.4, 0.8, 0.8, '#dbe9ff');
    R(g, x + 7.4, y + 4.2, 0.8, 0.8, '#9fc0ee');
    R(g, x + 12, y + 1.8, 0.8, 0.8, '#ffe9a8');
    R(g, x + w - 5, y + 2.6, 2.6, 2.6, '#ffe9a8');
    R(g, x + w - 6, y + 1.6, 1.4, 1.4, '#16295a');
    // 빌딩 실루엣
    for (var bx = 1; bx < w - 2; bx += 3.4) {
      var bh = 1.6 + ((bx * 7) % 5) * 0.7;
      R(g, x + bx, y + h - bh, 2.6, bh, '#0c1836');
      R(g, x + bx + 0.6, y + h - bh + 0.6, 0.7, 0.7, 'rgba(255,214,140,.5)');
    }
    R(g, x + w / 2 - 0.4, y, 0.8, h, '#3d5178');
    R(g, x, y + h / 2 - 0.4, w, 0.8, '#3d5178');
    R(g, x - 2, y + h + 1.6, w + 4, 1.1, '#1d2a44');
  }

  function poster(g, x, y, w, h, accent) {
    R(g, x, y, w, h, '#0f1a2e');
    R(g, x + 0.7, y + 0.7, w - 1.4, h - 1.4, '#16233c');
    R(g, x + 2, y + 2, w - 4, 1.2, accent);
    R(g, x + 2, y + 4.4, w - 6.5, 0.8, 'rgba(255,255,255,.22)');
    R(g, x + 2, y + 6, w - 8.5, 0.8, 'rgba(255,255,255,.14)');
    R(g, x + 2, y + 7.6, w - 5, 0.8, 'rgba(255,255,255,.10)');
  }

  function shelfUnit(g, x, y, w, h) {
    R(g, x, y, w, h, '#2b2116');
    R(g, x, y, w, 0.8, '#453522');
    var rows = 3, rh = (h - 1) / rows;
    for (var i = 0; i < rows; i++) {
      var sy = y + 1 + i * rh;
      R(g, x + 0.5, sy + rh - 0.8, w - 1, 0.7, '#4a3a26');
      var cols = ['#b5533f', '#3f6bb5', '#c9a227', '#4a8f6a', '#8a5bb5'];
      for (var b = 0; b < 4; b++) {
        R(g, x + 0.9 + b * (w - 1.8) / 4, sy + 0.4, (w - 2.4) / 4, rh - 1.6, cols[(i * 3 + b) % 5]);
      }
    }
  }

  function lamp(g, cx, y, wallH) {
    R(g, cx - 5, y, 10, 0.9, 'rgba(255,236,190,.55)');
    R(g, cx - 6.5, y + 0.9, 13, 2.4, 'rgba(255,214,140,.05)');
    R(g, cx - 9, y + wallH - 1, 18, 0.9, 'rgba(255,214,140,.03)');
  }

  /* ---------------------------------------------------------------- 대표실 */
  function drawCeoRoom(g) {
    var r = ROOMS.ceo, wallH = 13;
    roomBase(g, r, wallH, '#20293f', '#3a2b21', 0.28);
    // 러그
    R(g, r.x + 16, r.y + 28, 48, 20, '#3d1d1d');
    R(g, r.x + 17.4, r.y + 29.2, 45.2, 17.6, '#54262a');
    R(g, r.x + 17.4, r.y + 29.2, 45.2, 0.9, '#7d3b40');
    R(g, r.x + 17.4, r.y + 46, 45.2, 0.8, '#2e1414');
    // 창
    windowPanel(g, r.x + 7, r.y + 3.6, 28, 13);
    // 책장
    shelfUnit(g, r.x + 45, r.y + 3.4, 14, 17);
    // 현판
    R(g, r.x + 22, r.y + 1, 22, 3.2, '#241d10');
    R(g, r.x + 22.8, r.y + 1.6, 20.4, 2, '#c9a227');
    R(g, r.x + 25, r.y + 2.2, 1.6, 0.9, '#3a2f10');
    R(g, r.x + 28, r.y + 2.2, 1.6, 0.9, '#3a2f10');
    R(g, r.x + 31, r.y + 2.2, 1.6, 0.9, '#3a2f10');
    R(g, r.x + 35, r.y + 2.1, 6, 1.1, '#3a2f10');
    // 조명
    lamp(g, r.x + 39, r.y + 0.4, wallH);
    // 화분
    plant(g, r.x + 64, r.y + 24, 1.3);
    plant(g, r.x + 3, r.y + 22, 1);
    // 의자
    R(g, r.x + 31, r.y + 20, 13, 13, '#1a2234');
    R(g, r.x + 32, r.y + 21, 11, 11, '#28324a');
    R(g, r.x + 32, r.y + 21, 11, 1.4, '#3d4a6e');
    R(g, r.x + 32, r.y + 30, 11, 1.2, '#1a2234');
  }

  /* ---------------------------------------------------------------- 회의실 */
  function drawMeetingRoom(g) {
    var r = ROOMS.meet, wallH = 13;
    roomBase(g, r, wallH, '#1d2a44', '#212f49', 0.16);
    // 화이트보드
    R(g, r.x + 5, r.y + 3.4, 21, 9.6, '#2b3b5e');
    R(g, r.x + 5.6, r.y + 4, 19.8, 8.4, '#d3ddec');
    R(g, r.x + 7.4, r.y + 5.4, 5, 0.9, '#3f6bb5');
    R(g, r.x + 13.6, r.y + 5.4, 3, 0.9, '#b5533f');
    R(g, r.x + 17.8, r.y + 5.4, 4, 0.9, '#4a8f6a');
    R(g, r.x + 7.4, r.y + 7.2, 8, 0.7, '#8ea3c0');
    R(g, r.x + 7.4, r.y + 8.8, 11, 0.7, '#8ea3c0');
    R(g, r.x + 7.4, r.y + 10.4, 6, 0.7, '#c9a227');
    R(g, r.x + 5, r.y + 13, 21, 0.9, '#16203a');
    // 프로젝터 스크린
    R(g, r.x + 40, r.y + 3, 24, 8, '#111a2b');
    R(g, r.x + 40.6, r.y + 3.6, 22.8, 6.8, '#1b2a4a');
    R(g, r.x + 42.4, r.y + 5, 9, 0.9, 'rgba(60,224,255,.6)');
    R(g, r.x + 42.4, r.y + 6.6, 13, 0.9, 'rgba(74,222,128,.45)');
    R(g, r.x + 42.4, r.y + 8.2, 6, 0.9, 'rgba(255,209,102,.45)');
    R(g, r.x + 40, r.y + 11, 24, 0.8, '#1d283c');
    lamp(g, r.x + 40, r.y + 0.4, wallH);
    // 화분 / 정수기
    plant(g, r.x + 66, r.y + 14, 1.1);
    R(g, r.x + 70, r.y + 3.6, 6, 11, '#20293f');
    R(g, r.x + 70.6, r.y + 4.2, 4.8, 5, '#5fa8cc');
    R(g, r.x + 70.6, r.y + 9.8, 4.8, 1.4, '#39465f');
    R(g, r.x + 70.6, r.y + 12.4, 4.8, 1.6, '#2b3448');
    // 의자 받침(테이블은 front)
    R(g, r.x + 20, r.y + 22, 9, 3, '#1d283c');
    R(g, r.x + 20, r.y + 22, 9, 1, '#2b3a54');
    R(g, r.x + 45, r.y + 22, 9, 3, '#1d283c');
    R(g, r.x + 45, r.y + 22, 9, 1, '#2b3a54');
    R(g, r.x + 33, r.y + 42, 9, 3, '#1d283c');
    R(g, r.x + 33, r.y + 42, 9, 1, '#2b3a54');
  }

  /* ---------------------------------------------------------------- 부서 방 */
  function drawDeptRoom(g, r, key, idx) {
    var wallH = 12;
    roomBase(g, r, wallH, idx % 2 ? '#1d2740' : '#1b253c', idx % 2 ? '#1a2338' : '#182136', 0.18);
    var deskTop = r.y + r.h - 12, cx = r.x + r.w / 2;

    // 벽면 소품
    if (idx % 3 === 0) windowPanel(g, r.x + 5, r.y + 2.2, 21, 8.4);
    else if (idx % 3 === 1) poster(g, r.x + 5, r.y + 2.2, 13, 8.6, SHIRTS[key] || '#3ce0ff');
    else {
      R(g, r.x + 5, r.y + 2.2, 18, 8.6, '#111a2b');
      R(g, r.x + 5.6, r.y + 2.8, 16.8, 7.4, '#0d1626');
      R(g, r.x + 6.6, r.y + 3.8, 6, 0.8, 'rgba(60,224,255,.55)');
      R(g, r.x + 6.6, r.y + 5.4, 9, 0.8, 'rgba(255,209,102,.45)');
      R(g, r.x + 6.6, r.y + 7, 4.6, 0.8, 'rgba(74,222,128,.5)');
      R(g, r.x + 6.6, r.y + 8.6, 7.6, 0.8, 'rgba(167,139,250,.45)');
    }
    // 낮은 캐비닛
    R(g, r.x + 3, r.y + r.h - 17, 11, 8, '#232c40');
    R(g, r.x + 3, r.y + r.h - 17, 11, 1, '#33405a');
    R(g, r.x + 3.6, r.y + r.h - 14.6, 9.8, 0.6, '#1a2234');
    R(g, r.x + 3.6, r.y + r.h - 12, 9.8, 0.6, '#1a2234');
    R(g, r.x + 7.4, r.y + r.h - 15.6, 2.2, 0.8, '#8b97a6');
    R(g, r.x + 7.4, r.y + r.h - 13, 2.2, 0.8, '#8b97a6');

    lamp(g, cx, r.y + 0.4, wallH);

    // 화분 / 시계
    plant(g, r.x + r.w - 11, r.y + r.h - 12, 1);
    R(g, r.x + r.w - 13.5, r.y + 2.4, 5.6, 5.6, '#0d1728');
    R(g, r.x + r.w - 13, r.y + 2.9, 4.6, 4.6, '#dbe7f7');
    R(g, r.x + r.w - 11, r.y + 3.9, 0.7, 2, '#2b3a56');
    R(g, r.x + r.w - 11, r.y + 5.4, 1.5, 0.7, '#2b3a56');

    // 의자 (책상 뒤)
    R(g, cx - 6, deskTop - 9.5, 11, 10, '#161f30');
    R(g, cx - 5, deskTop - 8.8, 9, 9, '#222c42');
    R(g, cx - 5, deskTop - 8.8, 9, 1.2, '#33405a');
    R(g, cx - 5, deskTop - 1.4, 9, 1.2, '#161f30');
  }

  /* ---------------------------------------------------------------- 탕비실 */
  function drawPantry(g) {
    var r = ROOMS.pantry, wallH = 8;
    R(g, r.x, r.y, r.w, r.h, '#262e3d');
    for (var ty = r.y + wallH; ty < r.y + r.h; ty += 4) {
      for (var tx = r.x; tx < r.x + r.w; tx += 4) {
        var odd = (Math.floor((tx - r.x) / 4) + Math.floor((ty - r.y - wallH) / 4)) % 2 === 0;
        R(g, tx, ty, 4, 4, odd ? '#2a3242' : '#222938');
      }
    }
    R(g, r.x, r.y, r.w, wallH, '#2d3648');
    R(g, r.x, r.y, r.w, 0.9, 'rgba(150,190,255,.10)');
    R(g, r.x, r.y + wallH - 1, r.w, 1, '#151c28');

    // 벽면
    R(g, r.x + 8, r.y + 2, 10, 5, '#111a2b');
    R(g, r.x + 8.6, r.y + 2.5, 8.8, 4, '#0d1626');
    R(g, r.x + 9.4, r.y + 3.4, 3.4, 0.7, 'rgba(255,209,102,.55)');
    R(g, r.x + 9.4, r.y + 4.8, 5.4, 0.7, 'rgba(60,224,255,.4)');
    // 시계
    R(g, r.x + 116, r.y + 1.6, 6, 6, '#0d1728');
    R(g, r.x + 116.5, r.y + 2.1, 5, 5, '#dbe7f7');
    R(g, r.x + 118.6, r.y + 3.2, 0.7, 2, '#2b3a56');
    R(g, r.x + 118.6, r.y + 4.6, 1.6, 0.7, '#2b3a56');

    // 커피머신
    R(g, r.x + 13, r.y + 4.4, 10, 8.2, '#2b3446');
    R(g, r.x + 13, r.y + 4.4, 10, 1.8, '#3d4a63');
    R(g, r.x + 14.4, r.y + 6.6, 7.2, 3.6, '#141c2a');
    R(g, r.x + 15.4, r.y + 10.6, 5.2, 1.4, '#151d2b');
    R(g, r.x + 20.6, r.y + 5, 1.2, 1.2, '#ff6b6b');
    R(g, r.x + 14.8, r.y + 7.4, 6.2, 0.7, 'rgba(60,224,255,.35)');
    // 싱크대
    R(g, r.x + 34, r.y + 6.4, 12, 3, '#8b97a6');
    R(g, r.x + 35, r.y + 7, 10, 2, '#59647a');
    R(g, r.x + 38.5, r.y + 4.4, 1, 2.2, '#a3aebd');
    // 전자레인지
    R(g, r.x + 50, r.y + 3.6, 13, 8.4, '#333c4e');
    R(g, r.x + 50, r.y + 3.6, 13, 1.4, '#454f66');
    R(g, r.x + 51.4, r.y + 5.6, 7.6, 5.4, '#151d2b');
    R(g, r.x + 59.8, r.y + 6.4, 2.2, 1.2, '#8b97a6');
    R(g, r.x + 59.8, r.y + 9, 2.2, 1.2, '#8b97a6');
    // 냉장고
    R(g, r.x + 68, r.y + 2.6, 14, 14, '#3a4459');
    R(g, r.x + 68, r.y + 2.6, 14, 0.9, '#4e5c78');
    R(g, r.x + 68, r.y + 8.6, 14, 0.9, '#232b3b');
    R(g, r.x + 79.4, r.y + 5, 1, 2.6, '#8b97a6');
    R(g, r.x + 79.4, r.y + 9.8, 1, 2.6, '#8b97a6');
    // 정수기
    R(g, r.x + 86, r.y + 4.4, 7, 12, '#28324a');
    R(g, r.x + 86.8, r.y + 5.2, 5.4, 3.4, '#6fc3e0');
    R(g, r.x + 87.6, r.y + 10.6, 1.2, 1.2, '#3ce0ff');
    R(g, r.x + 90.4, r.y + 10.6, 1.2, 1.2, '#ff6b6b');
    // 복합기
    R(g, r.x + 98, r.y + 5, 22, 9, '#39445c');
    R(g, r.x + 98, r.y + 5, 22, 2, '#4d5b78');
    R(g, r.x + 100, r.y + 2.6, 18, 2.6, '#2c3547');
    R(g, r.x + 104, r.y + 8.4, 11, 1.6, '#e8eefc');
    R(g, r.x + 104, r.y + 8.4, 11, 0.5, '#b9c8e0');
    R(g, r.x + 100.6, r.y + 11.4, 4, 0.8, '#4ade80');
    // 소파
    R(g, r.x + 150, r.y + 9.6, 24, 12, '#3b2b3f');
    R(g, r.x + 150, r.y + 8, 24, 3, '#4a3550');
    R(g, r.x + 151.4, r.y + 11, 9.6, 8, '#553d5c');
    R(g, r.x + 163, r.y + 11, 9.6, 8, '#553d5c');
    R(g, r.x + 150, r.y + 21, 24, 1.4, '#2a1d2d');
    // 화분
    plant(g, r.x + 142, r.y + 12, 1);
    plant(g, r.x + 30, r.y + 12, 0.9);
  }

  /* ================================================================ FRONT */
  function buildFront() {
    var g = fctx;
    R(g, 0, 0, 0, 0, '#000');
    ceoDesk(g);
    meetingTable(g);
    var keys = ['economy', 'health', 'dayeon', 'global', 'local', 'finance', 'webtools'];
    for (var i = 0; i < keys.length; i++) deptDesk(g, ROOMS[keys[i]], keys[i], i);
    pantryCounter(g);
  }

  function woodDesk(g, x, y, w, h) {
    R(g, x, y + 0.6, w, h, '#3a281c');
    R(g, x, y, w, h - 1.6, '#6b4a33');
    R(g, x, y, w, 1.6, '#a07a52');
    R(g, x, y + h - 1.8, w, 1.8, '#2c1f16');
    for (var i = 1; i < w / 7; i++) R(g, x + i * 7, y + 1.8, 0.4, h - 3.4, 'rgba(0,0,0,.12)');
    R(g, x + 1.4, y + h - 0.4, 1.6, 2.2, '#2c1f16');
    R(g, x + w - 3, y + h - 0.4, 1.6, 2.2, '#2c1f16');
  }

  function monitor(g, x, y, w) {
    w = w || 12;
    R(g, x + w / 2 - 1, y + 6, 2, 2.6, '#3d4a63');
    R(g, x + w / 2 - 3.4, y + 8.2, 6.8, 0.9, '#3d4a63');
    R(g, x, y, w, 7, '#0f1724');
    R(g, x + 0.6, y + 0.6, w - 1.2, 5.8, '#0a2f36');
    R(g, x + 1.6, y + 1.4, 4.4, 0.8, 'rgba(46,230,200,.85)');
    R(g, x + 1.6, y + 2.8, 6.4, 0.8, 'rgba(46,230,200,.5)');
    R(g, x + 1.6, y + 4.2, 3.6, 0.8, 'rgba(46,230,200,.7)');
  }

  function deptDesk(g, r, key, idx) {
    var deskTop = r.y + r.h - 12, cx = r.x + r.w / 2;
    woodDesk(g, cx - 17, deskTop, 34, 6);
    // 키보드
    R(g, cx - 13, deskTop + 1.4, 9, 1.4, '#28324a');
    R(g, cx - 13, deskTop + 1.4, 9, 0.5, '#3d4a66');
    // 서류
    R(g, cx - 16, deskTop + 0.9, 3.4, 3.2, '#e8eefc');
    R(g, cx - 16, deskTop + 0.9, 3.4, 0.7, '#b9c8e0');
    R(g, cx - 15.6, deskTop + 2.1, 2.6, 0.5, '#b9c8e0');
    // 모니터
    monitor(g, cx + 5, deskTop - 7.4, 12);
    // 컵
    R(g, cx + 18.4, deskTop + 0.6, 2.6, 2.6, idx % 2 ? '#c96a4a' : '#5f8fbf');
    R(g, cx + 18.4, deskTop + 0.6, 2.6, 0.7, '#e8eefc');
  }

  function ceoDesk(g) {
    var r = ROOMS.ceo;
    woodDesk(g, r.x + 21, r.y + 33, 36, 7);
    // 결재 서류함
    R(g, r.x + 45, r.y + 29.6, 9, 4, '#1a2234');
    R(g, r.x + 45, r.y + 29.6, 9, 0.8, '#2b3a54');
    // 도장함
    R(g, r.x + 33, r.y + 35, 3, 2.6, '#c0392b');
    R(g, r.x + 33.4, r.y + 33.8, 2.2, 1.4, '#8e2a20');
    // 명패
    R(g, r.x + 27, r.y + 36.4, 6, 1.8, '#c9a227');
    R(g, r.x + 27.6, r.y + 36.8, 4.8, 1, '#3a2f10');
    // 모니터
    monitor(g, r.x + 51, r.y + 26.4, 11);
  }

  function meetingTable(g) {
    var r = ROOMS.meet;
    // 테이블
    R(g, r.x + 12, r.y + 30.6, 56, 9.4, '#1c2740');
    R(g, r.x + 12, r.y + 28, 56, 12, '#28374f');
    R(g, r.x + 12, r.y + 28, 56, 3.6, '#3d5170');
    R(g, r.x + 12, r.y + 28, 56, 0.9, '#5b779e');
    R(g, r.x + 12, r.y + 39, 56, 1, '#1a2434');
    // 다리
    R(g, r.x + 14, r.y + 40, 2.6, 3, '#1a2434');
    R(g, r.x + 63, r.y + 40, 2.6, 3, '#1a2434');
    // 회의 자료
    R(g, r.x + 18, r.y + 31, 7, 5, '#e8eefc');
    R(g, r.x + 18.6, r.y + 32, 5.6, 0.7, '#b9c8e0');
    R(g, r.x + 18.6, r.y + 33.4, 4.2, 0.7, '#b9c8e0');
    R(g, r.x + 28, r.y + 31.6, 7, 5, '#e8eefc');
    R(g, r.x + 28.6, r.y + 32.6, 5.6, 0.7, '#b9c8e0');
    R(g, r.x + 28.6, r.y + 34, 3.4, 0.7, '#b9c8e0');
    R(g, r.x + 48, r.y + 32, 6, 4, '#dfe8f7');
    R(g, r.x + 48.6, r.y + 33, 4.4, 0.6, '#a9bbd6');
    // 노트북
    R(g, r.x + 56, r.y + 31.4, 8, 4.4, '#2b3448');
    R(g, r.x + 56.6, r.y + 32, 6.8, 3.2, '#0a2f36');
    R(g, r.x + 57.4, r.y + 32.6, 3.2, 0.6, 'rgba(46,230,200,.8)');
  }

  function pantryCounter(g) {
    var r = ROOMS.pantry;
    // 카운터
    R(g, r.x + 8, r.y + 10.6, 44, 7, '#2f3849');
    R(g, r.x + 8, r.y + 10.6, 44, 2.4, '#48566f');
    R(g, r.x + 8, r.y + 10.6, 44, 0.7, '#67789a');
    R(g, r.x + 8, r.y + 17, 44, 1.2, '#1a2232');
    // 컵 / 트레이
    R(g, r.x + 17, r.y + 9.2, 2.6, 2.4, '#e8eefc');
    R(g, r.x + 27, r.y + 9.4, 3.6, 2, '#8b97a6');
    // 원형 테이블
    R(g, r.x + 128, r.y + 15, 20, 8.6, '#3a2a20');
    R(g, r.x + 128, r.y + 15, 20, 2.4, '#5c412c');
    R(g, r.x + 137, r.y + 23.6, 2, 3, '#2a1d14');
    R(g, r.x + 134, r.y + 13.4, 2.6, 2.4, '#e8eefc');
    // 소파 앞 테이블
    R(g, r.x + 150, r.y + 22, 13, 2.4, '#4a3527');
    R(g, r.x + 150, r.y + 22, 13, 0.8, '#6b4a33');
  }

  /* ================================================================ 봇 */
  function makeBot(o) {
    return {
      id: o.id, home: o.home, seat: { x: o.x, y: o.y },
      x: o.x, y: o.y, dir: 1, walkPhase: 0, walking: false,
      shirt: o.shirt || '#3ce0ff', hair: o.hair || '#241a14',
      skin: o.skin || SKINS[0], kind: o.kind || 'dept',
      state: 'work', t: 0, next: rnd(5, 13), path: [], onArrive: null,
      carry: false, phase: rnd(0, 6), spot: null, spotKey: null
    };
  }

  function seatOf(roomKey) {
    var r = ROOMS[roomKey];
    return { x: r.x + r.w / 2 - 1, y: r.y + r.h - 12 + 2 };
  }

  function initBots() {
    bots = [];
    deptList = DATA.departments || [];
    deptList.forEach(function (d, i) {
      var s = seatOf(d.room);
      var b = makeBot({
        id: d.id, home: d.room, x: s.x, y: s.y,
        shirt: SHIRTS[d.id] || '#3ce0ff', hair: HAIRS[d.id] || '#241a14',
        skin: SKINS[i % SKINS.length], kind: 'dept'
      });
      b.seat = s; b.dept = d;
      bots.push(b);
    });

    // 회의실 팀장 3 (테이블 뒤 = 앉은 자세)
    var leads = [
      { x: ROOMS.meet.x + 24, y: ROOMS.meet.y + 29 },
      { x: ROOMS.meet.x + 48, y: ROOMS.meet.y + 29 },
      { x: ROOMS.meet.x + 36, y: ROOMS.meet.y + 44 }
    ];
    leads.forEach(function (p, i) {
      var b = makeBot({
        id: 'lead' + i, home: 'meet', x: p.x, y: p.y,
        shirt: ['#8fb3ff', '#7aa2e8', '#9ab6ee'][i],
        hair: ['#2b2018', '#241a14', '#1f2733'][i],
        kind: 'lead', skin: SKINS[(i + 1) % 3]
      });
      b.state = 'meet'; b.next = 1e9;
      bots.push(b);
    });

    // 탕비실 2
    var rests = [
      { x: ROOMS.pantry.x + 30, y: ROOMS.pantry.y + 19.6 },
      { x: ROOMS.pantry.x + 161, y: ROOMS.pantry.y + 20.4 }
    ];
    rests.forEach(function (p, i) {
      var b = makeBot({
        id: 'rest' + i, home: 'pantry', x: p.x, y: p.y,
        shirt: ['#9aa6b6', '#c98a6b'][i], hair: ['#33261a', '#1f2733'][i],
        kind: 'rest', skin: SKINS[i]
      });
      b.state = 'coffee'; b.next = 1e9;
      bots.push(b);
    });

    // 대표
    var s = { x: ROOMS.ceo.x + 37, y: ROOMS.ceo.y + 34 };
    var ceo = makeBot({
      id: 'ceo', home: 'ceo', x: s.x, y: s.y,
      shirt: '#1f2536', hair: '#d9dde6', kind: 'ceo', skin: '#f2c69b'
    });
    ceo.state = 'ceo'; ceo.next = 1e9;
    bots.push(ceo);

    trayPapers = 0;
  }

  /* ---------------------------------------------------------------- 이동 */
  var SPEED = 15;
  function walk(b, dt) {
    if (!b.path.length) { b.walking = false; if (b.onArrive) { var f = b.onArrive; b.onArrive = null; f(); } return; }
    var dist = SPEED * dt, guard = 0;
    b.walking = true;
    while (dist > 0 && b.path.length && guard++ < 40) {
      var p = b.path[0];
      var dx = p.x - b.x, dy = p.y - b.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < 0.001) { b.path.shift(); continue; }
      if (d <= dist) {
        b.x = p.x; b.y = p.y; b.path.shift(); dist -= d;
        if (Math.abs(dx) > 0.01) b.dir = dx > 0 ? 1 : -1;
      } else {
        b.x += dx / d * dist; b.y += dy / d * dist;
        if (Math.abs(dx) > 0.01) b.dir = dx > 0 ? 1 : -1;
        b.walkPhase += dist * 1.1;
        dist = 0;
      }
    }
    if (!b.path.length) { b.walking = false; if (b.onArrive) { var f2 = b.onArrive; b.onArrive = null; f2(); } }
  }

  var spots = {
    meet: [
      { x: ROOMS.meet.x + 20, y: ROOMS.meet.y + 44 },
      { x: ROOMS.meet.x + 56, y: ROOMS.meet.y + 44 },
      { x: ROOMS.meet.x + 12, y: ROOMS.meet.y + 40 }
    ],
    pantry: [
      { x: ROOMS.pantry.x + 22, y: ROOMS.pantry.y + 20 },
      { x: ROOMS.pantry.x + 120, y: ROOMS.pantry.y + 20 },
      { x: ROOMS.pantry.x + 140, y: ROOMS.pantry.y + 22 }
    ],
    ceo: [{ x: ROOMS.ceo.x + 60, y: ROOMS.ceo.y + 42 }]
  };
  var taken = {};

  function claim(kind) {
    var arr = spots[kind];
    for (var i = 0; i < arr.length; i++) {
      var key = kind + i;
      if (!taken[key]) { taken[key] = true; return { i: i, p: arr[i], key: key }; }
    }
    return null;
  }
  function release(s) { if (s) taken[s.key] = false; }

  function goTrip(b, kind) {
    var sp = claim(kind);
    if (!sp) return false;
    var path = exitPath(b.home, { x: b.x, y: b.y });
    path = path.concat(enterPath(kind, sp.p));
    b.path = path;
    b.spot = sp;
    b.carry = kind === 'ceo';
    b.state = 'walk';
    b.onArrive = function () {
      b.state = kind === 'ceo' ? 'deliver' : (kind === 'meet' ? 'meet' : 'coffee');
      b.t = 0;
      b.next = kind === 'ceo' ? 1.9 : rnd(7, 11);
      b.spotKey = kind;
    };
    return true;
  }

  function goHome(b) {
    var path = exitPath(b.spotKey || b.home, { x: b.x, y: b.y });
    path = path.concat(enterPath(b.home, b.seat));
    b.path = path;
    b.state = 'walk';
    b.carry = false;
    release(b.spot); b.spot = null;
    b.onArrive = function () {
      b.state = 'work'; b.t = 0; b.next = rnd(6, 14); b.spotKey = null;
    };
  }

  function updateBot(b, dt) {
    b.t += dt;
    if (b.state === 'walk') { walk(b, dt); return; }
    if (b.state === 'work') {
      b.walking = false;
      if (b.t > b.next && b.kind === 'dept') {
        var roll = Math.random();
        if (roll < 0.42) { if (!goTrip(b, 'ceo')) b.next = b.t + rnd(3, 6); }
        else if (roll < 0.68) { if (!goTrip(b, 'meet')) b.next = b.t + rnd(3, 6); }
        else if (roll < 0.82) { if (!goTrip(b, 'pantry')) b.next = b.t + rnd(3, 6); }
        else b.next = b.t + rnd(6, 12);
      }
      return;
    }
    if (b.state === 'deliver') {
      if (b.t > 0.55 && !b.delivered) {
        b.delivered = true;
        effects.push({
          kind: 'paper', x: b.x + 3, y: b.y - 9,
          tx: ROOMS.ceo.x + 49, ty: ROOMS.ceo.y + 30.6, t: 0, dur: 0.9
        });
        if (trayPapers < 6) trayPapers++;
        stampFlash = 1;
      }
      if (b.t > b.next) { b.delivered = false; goHome(b); }
      return;
    }
    if (b.state === 'meet' || b.state === 'coffee') {
      if (b.t > b.next) goHome(b);
      return;
    }
    if (b.state === 'ceo') {
      stampT += dt;
      if (stampT > 6) { stampT = 0; stampFlash = 1; if (trayPapers < 6) trayPapers++; }
    }
  }

  /* ---------------------------------------------------------------- 스프라이트 */
  function drawBot(g, b, opts) {
    opts = opts || {};
    var x = Math.round(b.x), y = Math.round(b.y);
    var step = b.walking ? (Math.floor(b.walkPhase) % 2) : 0;
    var sit = !!opts.sit;

    R(g, x - 3.4, y - 0.8, 7, 1, 'rgba(0,0,0,.4)');
    if (!sit) {
      if (b.walking) {
        R(g, x - 2, y - 4, 2, 3 - step, '#1e2838');
        R(g, x + 1, y - 4, 2, 2 + step, '#1e2838');
        R(g, x - 3, y - 1 - step, 2, 1.6, '#0d1220');
        R(g, x + 1, y - 2 + step, 2, 1.6, '#0d1220');
      } else {
        R(g, x - 2, y - 4, 2, 3, '#1e2838');
        R(g, x + 1, y - 4, 2, 3, '#1e2838');
        R(g, x - 3, y - 2, 2, 1.8, '#0d1220');
        R(g, x + 1, y - 2, 2, 1.8, '#0d1220');
      }
    }
    // 몸통
    R(g, x - 3, y - 10, 6, 6, b.shirt);
    R(g, x - 3, y - 10, 6, 1.1, 'rgba(255,255,255,.20)');
    R(g, x - 1, y - 10, 2, 6, 'rgba(0,0,0,.12)');
    R(g, x - 3, y - 4.4, 6, 0.8, 'rgba(0,0,0,.22)');
    // 팔
    var arm = (b.state === 'work' || b.state === 'ceo') ? (Math.floor(performance.now() / 170 + (b.phase || 0)) % 2) : 0;
    R(g, x - 4.2, y - 9 + arm, 1.6, 3, b.shirt);
    R(g, x + 2.6, y - 9 + (1 - arm), 1.6, 3, b.shirt);
    R(g, x - 4.2, y - 6 + arm, 1.6, 1.6, b.skin);
    R(g, x + 2.6, y - 6 + (1 - arm), 1.6, 1.6, b.skin);
    // 머리
    R(g, x - 3, y - 15, 6, 5, b.skin);
    R(g, x - 3, y - 15.2, 6, 1.8, b.hair);
    R(g, x - 3.2, y - 14, 1.4, 2.8, b.hair);
    R(g, x + 1.8, y - 14, 1.4, 2.8, b.hair);
    R(g, x - 2, y - 12.4, 1, 1, '#10161f');
    R(g, x + 1, y - 12.4, 1, 1, '#10161f');
    R(g, x - 1, y - 10.4, 2, 0.7, 'rgba(0,0,0,.20)');

    if (b.kind === 'ceo') {
      R(g, x - 3.2, y - 17.6, 6.4, 1.8, '#ffd166');
      R(g, x - 3.2, y - 18.6, 1.6, 1.4, '#ffd166');
      R(g, x - 0.8, y - 19, 1.6, 1.8, '#ffe9a8');
      R(g, x + 1.6, y - 18.6, 1.6, 1.4, '#ffd166');
      R(g, x - 0.7, y - 9.4, 1.4, 4.6, '#c0392b');
      R(g, x - 1.2, y - 10.2, 2.4, 1.2, '#8e2a20');
    }
    if (b.kind === 'lead') {
      R(g, x - 0.7, y - 9.6, 1.4, 4.4, '#1f2a3f');
    }
    if (b.carry) {
      R(g, x + 3.6, y - 10, 3.2, 4.2, '#e8eefc');
      R(g, x + 3.6, y - 10, 3.2, 0.7, '#b9c8e0');
      R(g, x + 4.1, y - 8.6, 2.2, 0.6, '#a9bbd6');
      R(g, x + 4.1, y - 7.4, 1.6, 0.6, '#a9bbd6');
    }
  }

  /* ================================================================ 렌더 */
  function paint(now) {
    if (!ctx) return;
    var g = ctx, ts = now / 1000;
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.drawImage(backCv, 0, 0);

    // 모니터 빛 번짐
    deptList.forEach(function (d, i) {
      var r = ROOMS[d.room]; if (!r) return;
      var cx = r.x + r.w / 2;
      var fl = 0.05 + 0.04 * Math.sin(ts * 2.6 + i * 1.7);
      R(g, cx + 4, r.y + r.h - 22, 13, 12, 'rgba(46,230,200,' + fl.toFixed(3) + ')');
    });
    // 대표실 결재함 서류
    for (var p = 0; p < trayPapers; p++) {
      var py = ROOMS.ceo.y + 30.2 - p * 0.85;
      R(g, ROOMS.ceo.x + 46 + p * 0.3, py, 7, 1.1, p % 2 ? '#e8eefc' : '#cfdcef');
      R(g, ROOMS.ceo.x + 46 + p * 0.3, py, 7, 0.4, '#9fb2cc');
    }

    // 봇 (y 순서)
    var order = bots.slice().sort(function (a, b) { return a.y - b.y; });
    for (var i = 0; i < order.length; i++) {
      var b = order[i];
      if (b.kind === 'ceo') continue;
      var seated = !b.walking && (b.state === 'work' || b.state === 'meet' || b.state === 'coffee' || b.state === 'deliver');
      drawBot(g, b, { sit: seated && b.kind !== 'rest' });
    }
    var ceo = null;
    for (var c = 0; c < bots.length; c++) if (bots[c].kind === 'ceo') ceo = bots[c];
    if (ceo) drawBot(g, ceo, { sit: true });

    // 앞쪽 가구
    g.drawImage(frontCv, 0, 0);

    // 도장 효과
    if (stampFlash > 0) {
      stampFlash = Math.max(0, stampFlash - 0.022);
      var a = stampFlash;
      R(g, ROOMS.ceo.x + 31, ROOMS.ceo.y + 30, 13, 9, 'rgba(255,209,102,' + (a * 0.10).toFixed(3) + ')');
      // 머리 위 느낌표
      if (ceo) {
        R(g, ceo.x + 4, ceo.y - 22, 1.6, 3, 'rgba(255,209,102,' + a.toFixed(2) + ')');
        R(g, ceo.x + 4, ceo.y - 18, 1.6, 1.4, 'rgba(255,209,102,' + a.toFixed(2) + ')');
      }
    }

    // 탕비실 김
    var st = (ts * 1.3) % 3.2;
    R(g, ROOMS.pantry.x + 18.4, ROOMS.pantry.y + 8.4 - st, 1.2, 1.2, 'rgba(224,238,255,.20)');
    R(g, ROOMS.pantry.x + 19.4, ROOMS.pantry.y + 6.4 - st * 0.7, 1, 1, 'rgba(224,238,255,.12)');

    // 서류 이동
    for (var e = effects.length - 1; e >= 0; e--) {
      var f = effects[e];
      f.t += 1 / 60;
      var k = Math.min(1, f.t / f.dur);
      var px = f.x + (f.tx - f.x) * k;
      var py = f.y + (f.ty - f.y) * k - Math.sin(k * Math.PI) * 6;
      R(g, px, py, 3.2, 3.8, '#e8eefc');
      R(g, px, py, 3.2, 0.8, '#a9bbd6');
      if (k >= 1) effects.splice(e, 1);
    }
  }

  /* ================================================================ 오버레이 */
  function buildOverlay() {
    var ov = $('#overlay');
    ov.innerHTML = '';
    var depts = DATA.departments || [];

    depts.forEach(function (d) {
      var r = ROOMS[d.room]; if (!r) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'room-hit';
      btn.dataset.dept = d.id;
      btn.style.left = (r.x / VW * 100) + '%';
      btn.style.top = (r.y / VH * 100) + '%';
      btn.style.width = (r.w / VW * 100) + '%';
      btn.style.height = (r.h / VH * 100) + '%';
      btn.setAttribute('aria-label', d.name + ' 상세 보기');
      btn.innerHTML =
        '<span class="room-tag">' + esc(d.icon || '') + ' ' + esc(d.name) + '</span>' +
        '<span class="room-bubble ' + esc(d.status || '') + '">' + esc(d.bubble || '') + '</span>';
      ov.appendChild(btn);
    });

    [
      { r: ROOMS.ceo, html: '<span class="room-tag">👑 대표실 · 각하</span>' },
      { r: ROOMS.meet, html: '<span class="room-tag">🗣️ 회의실</span>' },
      { r: ROOMS.pantry, html: '<span class="room-tag">☕ 탕비실</span>' }
    ].forEach(function (o) {
      var d = document.createElement('div');
      d.className = 'room-static';
      d.style.left = (o.r.x / VW * 100) + '%';
      d.style.top = (o.r.y / VH * 100) + '%';
      d.style.width = (o.r.w / VW * 100) + '%';
      d.style.height = (o.r.h / VH * 100) + '%';
      d.innerHTML = o.html;
      ov.appendChild(d);
    });

    var ap = (DATA.approvals || []).length;
    if (ap) {
      var badge = document.createElement('div');
      badge.className = 'room-static';
      badge.style.left = ((ROOMS.ceo.x + ROOMS.ceo.w - 3) / VW * 100) + '%';
      badge.style.top = ((ROOMS.ceo.y + 4) / VH * 100) + '%';
      badge.style.transform = 'translateX(-100%)';
      badge.innerHTML = '<span class="room-badge">결재 ' + ap + '</span>';
      ov.appendChild(badge);
    }
    if (DATA.ceo && DATA.ceo.bubble) {
      var cb = document.createElement('div');
      cb.className = 'room-static';
      cb.style.left = ((ROOMS.ceo.x + 2) / VW * 100) + '%';
      cb.style.top = ((ROOMS.ceo.y + 25) / VH * 100) + '%';
      cb.innerHTML = '<span class="room-bubble wait" style="position:static">' + esc(DATA.ceo.bubble) + '</span>';
      ov.appendChild(cb);
    }
    var rests = (bots.filter(function (b) { return b.kind === 'rest'; }) || []).length;
    var pb = document.createElement('div');
    pb.className = 'room-static';
    pb.style.left = ((ROOMS.pantry.x + ROOMS.pantry.w - 3) / VW * 100) + '%';
    pb.style.top = ((ROOMS.pantry.y + 3) / VH * 100) + '%';
    pb.style.transform = 'translateX(-100%)';
    pb.innerHTML = '<span class="room-badge">휴게 2</span>';
    ov.appendChild(pb);

    applySelection();
  }

  function applySelection() {
    document.querySelectorAll('.room-hit').forEach(function (el) {
      el.classList.toggle('sel', el.dataset.dept === selected);
    });
  }

  /* ================================================================ 패널 */
  function renderPanels() {
    var ap = DATA.approvals || [];
    $('#apCnt').textContent = ap.length;
    $('#approvals').innerHTML = ap.map(function (a) {
      return '<article class="ap' + (a.urgent ? ' urgent' : '') + '">' +
        '<span class="ico">' + esc(a.icon || '📄') + '</span>' +
        '<div>' +
        '<h3>' + esc(a.title) + (a.urgent ? '<span class="dday">D-1</span>' : '') + '</h3>' +
        '<p class="sub">' + esc(a.team) + ' · ' + esc(a.meta) + '</p>' +
        '<div class="opts">' + (a.options || []).map(function (o) {
          return '<span>' + esc(o) + '</span>';
        }).join('') + '<span class="q">' + esc(a.note || '확인') + '</span></div>' +
        '</div></article>';
    }).join('') +
      '<p class="note">각하 결정은 앱에서 지시하면 그대로 처리된다 · 선택지는 참고 표시</p>';

    var done = DATA.completed || [];
    $('#doneCnt').textContent = done.length;
    $('#completed').innerHTML = done.map(function (t) {
      var links = (t.links || []).map(function (l) {
        return '<a href="' + esc(l.href) + '">' + esc(l.label) + '</a>';
      }).join('');
      return '<article class="team">' +
        '<h3>' + esc(t.icon || '') + ' ' + esc(t.team) + '<span class="ok">완료</span></h3>' +
        '<ul>' + (t.items || []).map(function (it) { return '<li>' + esc(it) + '</li>'; }).join('') + '</ul>' +
        (links ? '<div class="links">' + links + '</div>' : '') +
        '</article>';
    }).join('');

    var logs = DATA.logs || [];
    $('#logs').innerHTML = logs.map(function (l) {
      return '<div><time>' + esc(l.t) + '</time><span>' + esc(l.text) + '</span></div>';
    }).join('');

    $('#headline').textContent = DATA.headline || '';
    var d = new Date(DATA.updated || Date.now());
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    $('#updated').textContent = '갱신 ' + hh + ':' + mm;
    $('#stamp').textContent = '마지막 갱신 ' + String(DATA.updated || '').replace('T', ' ').slice(0, 16);

    renderDetail();
  }

  function stateLabel(s) {
    if (s === 'ok') return '완료';
    if (s === 'wait') return '결재대기';
    return '진행중';
  }

  function renderDetail() {
    var body = $('#detailBody'), hint = $('#detailHint');
    var depts = DATA.departments || [];

    if (!selected) {
      hint.textContent = '방 선택';
      var rows = depts.map(function (d) {
        return '<li class="done" style="cursor:pointer" data-dept="' + esc(d.id) + '">' +
          '<i style="background:' + (d.status === 'wait' ? '#ffd166' : d.status === 'ok' ? '#4ade80' : '#8fd0ff') + '"></i>' +
          '<span style="flex:1">' + esc(d.icon || '') + ' ' + esc(d.name) + ' — ' + esc(d.bubble || '') + '</span>' +
          '<b style="font-weight:800;color:#7f96b8;font-variant-numeric:tabular-nums">' + (d.progress || 0) + '%</b>' +
          '</li>';
      }).join('');
      body.innerHTML =
        '<div class="hd"><span class="nm">오피스 전체</span><span class="st run">가동중</span></div>' +
        '<div class="chips"><span>7팀</span><span>봇 13명</span><span>결재 ' + (DATA.approvals || []).length + '건</span></div>' +
        '<ul class="tasks" id="deptRows">' + rows + '</ul>' +
        '<p class="note">방이나 팀 이름을 누르면 상세가 열린다</p>';
      return;
    }

    var d = depts.find(function (x) { return x.id === selected; });
    if (!d) { selected = null; return renderDetail(); }
    hint.textContent = d.name;
    var links = (d.links || []).map(function (l) {
      return '<a href="' + esc(l.href) + '">' + esc(l.label) + '</a>';
    }).join('');
    body.innerHTML =
      '<div class="hd"><span class="nm">' + esc(d.icon || '') + ' ' + esc(d.name) + '</span>' +
      '<span class="st ' + esc(d.status || 'run') + '">' + stateLabel(d.status) + '</span>' +
      '<span style="margin-left:auto;font-size:9.5px;color:#5f7392">' + esc(d.updated || '') + ' 갱신</span></div>' +
      '<div class="chips">' + (d.channels || []).map(function (c) { return '<span>' + esc(c) + '</span>'; }).join('') + '</div>' +
      '<div class="bar ' + (d.status === 'wait' ? 'wait' : '') + '"><i style="width:' + Math.max(4, Math.min(100, d.progress || 0)) + '%"></i></div>' +
      '<div class="pct"><span>진행률</span><span>' + (d.progress || 0) + '%</span></div>' +
      '<ul class="tasks">' + (d.tasks || []).map(function (t) {
        return '<li class="' + esc(t.state || 'run') + '"><i></i><span>' + esc(t.text) + '</span></li>';
      }).join('') + '</ul>' +
      (links ? '<div class="links">' + links + '</div>' : '') +
      '<p class="note">방을 다시 누르면 전체 보기로 돌아간다</p>';
  }

  function selectDept(id, scroll) {
    selected = (selected === id) ? null : id;
    applySelection();
    renderDetail();
    if (scroll && selected) {
      var el = $('#detailPanel');
      var top = el.getBoundingClientRect().top + window.scrollY - 58;
      if (window.innerWidth < 900 && (window.scrollY + window.innerHeight) < (top + 40)) {
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
    }
  }

  /* ================================================================ 데이터 */
  var FALLBACK = {
    site: '당버지 AI 오피스', updated: '', headline: '데이터 로드 실패 — office/data.json 확인',
    approvals: [], completed: [], logs: [],
    departments: [
      { id: 'economy', name: '경제·X팀', icon: '📈', room: 'economy', channels: ['kingwon1633'], bubble: '', status: 'run', progress: 0, tasks: [] },
      { id: 'health', name: '건강·공포팀', icon: '🏥', room: 'health', channels: ['kingdom1541'], bubble: '', status: 'run', progress: 0, tasks: [] },
      { id: 'dayeon', name: '다연돈팀', icon: '🎭', room: 'dayeon', channels: ['smart_actor'], bubble: '', status: 'run', progress: 0, tasks: [] },
      { id: 'global', name: '해외수면팀', icon: '🇧🇷', room: 'global', channels: ['Oração & Paz'], bubble: '', status: 'run', progress: 0, tasks: [] },
      { id: 'local', name: '로컬직판팀', icon: '🔮', room: 'local', channels: ['희망당'], bubble: '', status: 'run', progress: 0, tasks: [] },
      { id: 'finance', name: '재무·스폰서팀', icon: '💰', room: 'finance', channels: ['세후로', 'Ducat'], bubble: '', status: 'run', progress: 0, tasks: [] },
      { id: 'webtools', name: '웹도구팀', icon: '🛠️', room: 'webtools', channels: ['릴스 편집기', '차트'], bubble: '', status: 'run', progress: 0, tasks: [] }
    ]
  };

  function boot(data) {
    DATA = data;
    initBots();
    buildOverlay();
    renderPanels();
  }

  function loadData(first) {
    fetch('./data.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) {
        if (!d || !d.departments) throw new Error('bad json');
        if (first) boot(d);
        else {
          var keep = selected, keepTray = trayPapers;
          DATA = d;
          initBots();
          trayPapers = keepTray;
          buildOverlay(); renderPanels();
          selected = keep; applySelection(); renderDetail();
        }
      })
      .catch(function (e) {
        if (first) {
          boot(FALLBACK);
          var b = document.createElement('div');
          b.className = 'err';
          b.textContent = 'office/data.json 을 불러오지 못했습니다 (' + e.message + '). 부서 이름만 표시합니다.';
          document.querySelector('.stage').appendChild(b);
        }
      });
  }

  /* ================================================================ 루프 */
  function loop(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    try {
      for (var i = 0; i < bots.length; i++) updateBot(bots[i], dt);
      paint(now);
    } catch (err) { }
    requestAnimationFrame(loop);
  }

  function clockTick() {
    var d = new Date();
    $('#clock').textContent =
      String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0') + ':' +
      String(d.getSeconds()).padStart(2, '0');
  }

  /* ================================================================ 시작 */
  function start() {
    canvas = $('#office');
    layout();
    clockTick();
    setInterval(clockTick, 1000);

    var rt = null;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(layout, 120);
    });

    document.addEventListener('click', function (ev) {
      var hit = ev.target.closest ? ev.target.closest('[data-dept]') : null;
      if (hit && hit.dataset.dept) selectDept(hit.dataset.dept, hit.classList.contains('room-hit'));
    });

    loadData(true);
    setInterval(function () { loadData(false); }, 300000);
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
