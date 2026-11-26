/* 당버지 AI 오피스 — 픽셀아트 현황판
 * 데이터는 ./data.json 만 고치면 반영된다. (5분마다 자동 재조회)
 */
(function () {
  'use strict';

  var VW = 180, VH = 232;          // 가상 픽셀 캔버스 크기
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

  var C = {
    bg: '#070a14',
    wall: '#18213a', wall2: '#141c31', wallLine: '#0e1527',
    corr: '#0f1728', corr2: '#131d31', corrLine: '#1a2740',
    ceil: '#0b1220', frame: '#0a1020',
    ceoFloor: '#3a2a20', meetFloor: '#212f49', deptFloor: '#1b2438', pantryFloor: '#242b38',
    wood: '#5a3f2c', wood2: '#7d5a3d', wood3: '#94704d',
    steel: '#39465f', steel2: '#4c5d7c',
    screen: '#2ee6c8', paper: '#e8eefc', ink: '#8fa5c6',
    gold: '#ffd166', neon: '#3ce0ff', green: '#4ade80', pink: '#ff7ba9',
    red: '#ff6b6b', violet: '#a78bfa'
  };

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
  var DATA = null;
  var S = 1;                        // 가상 1px = S device px
  var canvas, ctx, staticCanvas, sctx;
  var bots = [], effects = [], trayPapers = 0, stampT = 0, stampFlash = 0;
  var selected = null;
  var last = 0, rafId = 0;
  var deptList = [];

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

  /* ---------------------------------------------------------------- 문 좌표 */
  function doorOf(key) {
    var r = ROOMS[key];
    if (r.kind === 'pantry') return { ix: CORR_X, iy: 199, cx: CORR_X };
    var y = r.y + r.h - 9;
    if (r.side === 'L') return { ix: r.x + r.w - 4, iy: y, cx: CORR_X };
    return { ix: r.x + 4, iy: y, cx: CORR_X };
  }
  function exitPath(key, from) {
    var d = doorOf(key), p = [];
    if (key === 'pantry') {
      p.push({ x: from.x, y: 202 }); p.push({ x: CORR_X, y: 202 }); p.push({ x: CORR_X, y: d.iy });
    } else {
      p.push({ x: from.x, y: d.iy }); p.push({ x: d.ix, y: d.iy }); p.push({ x: CORR_X, y: d.iy });
    }
    return p;
  }
  function enterPath(key, to) {
    var d = doorOf(key), p = [];
    if (key === 'pantry') {
      p.push({ x: CORR_X, y: d.iy }); p.push({ x: CORR_X, y: 202 }); p.push({ x: to.x, y: 202 }); p.push({ x: to.x, y: to.y });
    } else {
      p.push({ x: CORR_X, y: d.iy }); p.push({ x: d.ix, y: d.iy }); p.push({ x: to.x, y: d.iy }); p.push({ x: to.x, y: to.y });
    }
    return p;
  }

  /* ================================================================ 캔버스 */
  function layout() {
    var holder = $('#holder');
    var w = holder.clientWidth || 360;
    var maxH = Math.max(360, (window.innerHeight || 800) * 0.74);
    var cssW = Math.min(w, maxH * VW / VH);
    cssW = Math.max(240, cssW);
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

    staticCanvas = document.createElement('canvas');
    staticCanvas.width = canvas.width;
    staticCanvas.height = canvas.height;
    sctx = staticCanvas.getContext('2d');
    sctx.imageSmoothingEnabled = false;

    buildStatic();
    try { paint(performance.now()); } catch (e) { }

    // 라벨/말풍선 글자 크기를 캔버스 폭에 맞춰 조정
    var tagFs = Math.max(8, Math.min(13, cssW / 180 * 4.8));
    var bubFs = Math.max(7.5, Math.min(12, cssW / 180 * 4.3));
    holder.style.setProperty('--fs-tag', tagFs.toFixed(1) + 'px');
    holder.style.setProperty('--fs-bub', bubFs.toFixed(1) + 'px');
  }

  /* ---------------------------------------------------------------- 정적 배경 */
  function buildStatic() {
    var g = sctx;
    R(g, 0, 0, VW, VH, C.bg);

    // 바깥 프레임
    R(g, 0, 0, VW, VH, '#0a0f1c');
    R(g, 1, 1, VW - 2, VH - 2, '#101a2e');
    R(g, 2, 2, VW - 4, VH - 4, C.bg);

    // 복도
    R(g, CORR_X - 6, 3, 12, 193, C.corr);
    for (var y = 4; y < 194; y += 6) R(g, CORR_X - 6, y, 12, 0.6, 'rgba(255,255,255,.045)');
    R(g, CORR_X - 1.5, 3, 3, 193, C.corr2);
    for (var y2 = 6; y2 < 193; y2 += 9) R(g, CORR_X - 1.5, y2, 3, 1, 'rgba(60,224,255,.10)');

    // 각 방
    drawCeoRoom(g);
    drawMeetingRoom(g);
    var boxes = ['economy', 'health', 'dayeon', 'global', 'local', 'finance', 'webtools'];
    for (var i = 0; i < boxes.length; i++) drawDeptRoom(g, ROOMS[boxes[i]], boxes[i], i);
    drawPantry(g);

    // 층 벽
    wallBand(g, 3, 52, 174, 3);            // 대표실/회의실 ↔ 부서층
    wallBand(g, 3, 193, 81, 3);            // 부서층 ↔ 탕비실 (좌)
    wallBand(g, 99, 193, 78, 3);           // (우)
    wallVert(g, 81, 3, 3, 193);            // 좌측 방 ↔ 복도
    wallVert(g, 96, 3, 3, 193);            // 복도 ↔ 우측 방

    // 문 (벽 위에 구멍 + 빛)
    drawDoorH(g, 'L', ROOMS.ceo);
    drawDoorH(g, 'R', ROOMS.meet);
    for (var k = 0; k < boxes.length; k++) {
      var key = boxes[k], rr = ROOMS[key];
      drawDoorH(g, rr.side, rr);
    }
    R(g, CORR_X - 6, 193, 12, 3, '#080d18');
    R(g, CORR_X - 5, 193, 10, 1, 'rgba(255,214,140,.14)');

    // 복도 천장등
    for (var ly = 12; ly < 190; ly += 26) {
      R(g, CORR_X - 3, ly, 6, 1.4, 'rgba(190,220,255,.55)');
      R(g, CORR_X - 5, ly + 1.4, 10, 1, 'rgba(120,180,255,.10)');
    }

    // 3F 표찰
    R(g, CORR_X - 5, 96, 10, 6, '#0b1424');
    R(g, CORR_X - 4.5, 96.5, 9, 5, '#16233c');
    R(g, CORR_X - 3, 98, 1.2, 2, '#8fb6d8');
    R(g, CORR_X - 1.3, 98, 1.2, 2, '#8fb6d8');
    R(g, CORR_X + 0.4, 98, 1.2, 2, '#8fb6d8');
    R(g, CORR_X + 2.1, 97.6, 1.2, 2.8, '#4ade80');

    // 모서리 장식
    R(g, 2, 2, 3, 1, '#1d3050'); R(g, 2, 2, 1, 3, '#1d3050');
    R(g, VW - 5, 2, 3, 1, '#1d3050'); R(g, VW - 3, 2, 1, 3, '#1d3050');
    R(g, 2, VH - 3, 3, 1, '#1d3050'); R(g, 2, VH - 5, 1, 3, '#1d3050');
    R(g, VW - 5, VH - 3, 3, 1, '#1d3050'); R(g, VW - 3, VH - 5, 1, 3, '#1d3050');
  }

  function wallBand(g, x, y, w, h) {
    R(g, x, y, w, h, '#0d1526');
    R(g, x, y, w, 0.8, '#1b2a44');
    R(g, x, y + h - 0.8, w, 0.8, '#070c16');
  }
  function wallVert(g, x, y, w, h) {
    R(g, x, y, w, h, '#0d1526');
    R(g, x, y, 0.8, h, '#1b2a44');
    R(g, x + w - 0.8, y, 0.8, h, '#070c16');
  }
  function drawDoorH(g, side, r) {
    var y = r.y + r.h - 9;
    if (side === 'L') {
      R(g, r.x + r.w, y - 4, 3, 8, '#070c16');
      R(g, r.x + r.w - 1, y - 4, 1, 8, 'rgba(255,214,140,.10)');
    } else {
      R(g, r.x - 3, y - 4, 3, 8, '#070c16');
      R(g, r.x, y - 4, 1, 8, 'rgba(255,214,140,.10)');
    }
  }

  /* ---------------------------------------------------------------- 방 공통 */
  function roomShell(g, r, floorColor, wallColor, wallH) {
    R(g, r.x, r.y, r.w, r.h, wallColor || C.wall);
    // 벽 패널
    for (var x = r.x + 5; x < r.x + r.w - 2; x += 7) {
      R(g, x, r.y + 1, 0.8, wallH - 1, 'rgba(0,0,0,.22)');
      R(g, x + 0.8, r.y + 1, 0.6, wallH - 1, 'rgba(255,255,255,.03)');
    }
    R(g, r.x, r.y, r.w, 0.8, 'rgba(255,255,255,.05)');
    // 바닥
    R(g, r.x, r.y + wallH, r.w, r.h - wallH, floorColor);
    for (var yy = r.y + wallH; yy < r.y + r.h; yy += 3) R(g, r.x, yy, r.w, 0.5, 'rgba(0,0,0,.20)');
    // 걸레받이
    R(g, r.x, r.y + wallH - 1, r.w, 1, '#0b1220');
    R(g, r.x, r.y + wallH, r.w, 0.6, 'rgba(255,255,255,.06)');
  }

  function plant(g, x, y, s) {
    s = s || 1;
    R(g, x + 1, y + 4, 4, 3, '#6b4a33');
    R(g, x + 1, y + 4, 4, 0.8, '#8a6242');
    R(g, x + 1.5, y + 1, 3, 3.2, '#2f7d4f');
    R(g, x + 0.6, y + 2, 1.4, 2, '#39a066');
    R(g, x + 3.6, y + 1.4, 1.4, 2.4, '#39a066');
    R(g, x + 2.2, y, 1.4, 1.6, '#4bbd7a');
  }

  function windowPanel(g, x, y, w, h) {
    R(g, x - 1, y - 1, w + 2, h + 2, '#2b3a56');
    R(g, x, y, w, h, '#0a1633');
    // 별
    R(g, x + 3, y + 3, 0.8, 0.8, '#cfe3ff');
    R(g, x + 9, y + 6, 0.8, 0.8, '#9fc0ee');
    R(g, x + 15, y + 2.5, 0.8, 0.8, '#ffe9a8');
    R(g, x + 20, y + 8, 0.8, 0.8, '#cfe3ff');
    R(g, x + 6, y + 10, 0.8, 0.8, '#7f9ecb');
    R(g, x + w - 9, y + 3, 3, 3, '#ffe9a8');
    R(g, x + w - 10, y + 2, 1.6, 1.6, '#0a1633');
    R(g, x + w / 2 - 0.4, y, 0.8, h, '#2b3a56');
    R(g, x, y + h / 2 - 0.4, w, 0.8, '#2b3a56');
    R(g, x - 2, y + h + 1, w + 4, 1.2, '#1d2a44');
  }

  function shelf(g, x, y, w, h) {
    R(g, x, y, w, h, '#2b2116');
    R(g, x, y, w, 0.8, '#3d3020');
    for (var i = 0; i < 3; i++) {
      var sy = y + 2 + i * (h - 2) / 3;
      R(g, x, sy + (h - 2) / 3 - 1, w, 0.8, '#4a3a26');
      var cols = ['#b5533f', '#3f6bb5', '#c9a227', '#4a8f6a', '#8a5bb5'];
      for (var b = 0; b < 4; b++) {
        R(g, x + 1 + b * (w - 2) / 4, sy + 0.4, (w - 3) / 4 - 0.6, (h - 2) / 3 - 1.6, cols[(i * 3 + b) % 5]);
      }
    }
  }

  /* ---------------------------------------------------------------- 대표실 */
  function drawCeoRoom(g) {
    var r = ROOMS.ceo, wallH = 13;
    roomShell(g, r, C.ceoFloor, '#1e2740', wallH);
    // 러그
    R(g, r.x + 18, r.y + 30, 44, 19, '#4a2020');
    R(g, r.x + 19.4, r.y + 31, 41, 17, '#5c2828');
    R(g, r.x + 19.4, r.y + 31, 41, 0.8, '#7a3a3a');
    // 창
    windowPanel(g, r.x + 8, r.y + 4, 30, 15);
    // 책장
    shelf(g, r.x + 46, r.y + 4, 13, 20);
    // 현판
    R(g, r.x + 24, r.y + 1.4, 24, 3.6, '#2a2417');
    R(g, r.x + 25, r.y + 2, 22, 2.4, '#c9a227');
    R(g, r.x + 28, r.y + 2.8, 2, 0.9, '#3a2f10');
    R(g, r.x + 31.5, r.y + 2.8, 2, 0.9, '#3a2f10');
    R(g, r.x + 35, r.y + 2.8, 2, 0.9, '#3a2f10');
    R(g, r.x + 40, r.y + 2.6, 5, 1.2, '#3a2f10');
    // 화분
    plant(g, r.x + 64, r.y + 24, 1.2);
    plant(g, r.x + 4, r.y + 26, 1);
    // 의자(뒤)
    R(g, r.x + 34, r.y + 22, 12, 11, '#20263a');
    R(g, r.x + 35, r.y + 23, 10, 9, '#2b3450');
    R(g, r.x + 35, r.y + 23, 10, 1.4, '#3d4a6e');
    // 서류 트레이 자리
    R(g, r.x + 46, r.y + 29, 8, 4, '#1a2234');
    // 책상
    R(g, r.x + 21, r.y + 33, 33, 7, C.wood);
    R(g, r.x + 21, r.y + 33, 33, 2, C.wood3);
    R(g, r.x + 21, r.y + 33, 33, 0.7, '#b08a63');
    R(g, r.x + 22, r.y + 39, 2, 2, '#3d2a1e');
    R(g, r.x + 51, r.y + 39, 2, 2, '#3d2a1e');
    // 서류·도장
    R(g, r.x + 27, r.y + 35.5, 5, 3.6, '#e8eefc');
    R(g, r.x + 27.5, r.y + 36.4, 4, 0.6, '#b9c8e0');
    R(g, r.x + 27.5, r.y + 37.6, 3, 0.6, '#b9c8e0');
    R(g, r.x + 36, r.y + 36, 2.6, 2.6, '#c0392b');
    R(g, r.x + 36.4, r.y + 34.6, 1.8, 1.6, '#8e2a20');
  }

  /* ---------------------------------------------------------------- 회의실 */
  function drawMeetingRoom(g) {
    var r = ROOMS.meet, wallH = 13;
    roomShell(g, r, C.meetFloor, '#1b283f', wallH);
    // 화이트보드
    R(g, r.x + 5, r.y + 3.4, 19, 2.4, '#1f2c45');
    R(g, r.x + 5.4, r.y + 4, 18, 1.4, '#cdd9ec');
    R(g, r.x + 7, r.y + 4.4, 4, 0.6, '#3f6bb5');
    R(g, r.x + 12.4, r.y + 4.4, 2.4, 0.6, '#b5533f');
    R(g, r.x + 16, r.y + 4.4, 3, 0.6, '#4a8f6a');
    R(g, r.x + 5, r.y + 5.8, 19, 0.6, '#16203a');
    // 프로젝터 스크린
    R(g, r.x + 40, r.y + 3.6, 22, 3, '#172038');
    R(g, r.x + 40.6, r.y + 4.2, 20.8, 1.8, '#243354');
    R(g, r.x + 42, r.y + 4.9, 8, 0.6, 'rgba(60,224,255,.55)');
    R(g, r.x + 52, r.y + 4.9, 5, 0.6, 'rgba(74,222,128,.5)');
    // 화분 / 정수기
    plant(g, r.x + 66, r.y + 16, 1);
    R(g, r.x + 70, r.y + 3.4, 6, 10, '#20293f');
    R(g, r.x + 70.6, r.y + 4, 4.8, 5, '#7fc8e8');
    R(g, r.x + 70.6, r.y + 9.6, 4.8, 1.2, '#39465f');
    // 테이블
    R(g, r.x + 12, r.y + 27, 56, 13, '#28374f');
    R(g, r.x + 12, r.y + 27, 56, 3.4, '#3b4f6d');
    R(g, r.x + 12, r.y + 27, 56, 0.8, '#5a7ba8');
    R(g, r.x + 13, r.y + 39, 3, 3, '#1d283c');
    R(g, r.x + 64, r.y + 39, 3, 3, '#1d283c');
    // 회의 자료
    R(g, r.x + 18, r.y + 31, 7, 5, '#e8eefc');
    R(g, r.x + 18.6, r.y + 32, 5.6, 0.7, '#b9c8e0');
    R(g, r.x + 18.6, r.y + 33.4, 4.2, 0.7, '#b9c8e0');
    R(g, r.x + 28, r.y + 31.6, 7, 5, '#e8eefc');
    R(g, r.x + 28.6, r.y + 32.6, 5.6, 0.7, '#b9c8e0');
    R(g, r.x + 28.6, r.y + 34, 3.4, 0.7, '#b9c8e0');
    R(g, r.x + 48, r.y + 32, 6, 4, '#dfe8f7');
    R(g, r.x + 48.6, r.y + 33, 4.4, 0.6, '#a9bbd6');
    // 의자들
    chair(g, r.x + 22, r.y + 25);
    chair(g, r.x + 47, r.y + 25);
    chair(g, r.x + 35, r.y + 42);
  }
  function chair(g, x, y) {
    R(g, x - 4, y, 8, 3, '#1d283c');
    R(g, x - 4, y, 8, 1, '#2b3a54');
  }

  /* ---------------------------------------------------------------- 부서 방 */
  function drawDeptRoom(g, r, key, idx) {
    var wallH = 12;
    var floors = ['#1b2438', '#1c263c', '#1a2336', '#1d273e'];
    roomShell(g, r, floors[idx % 4], '#19223a', wallH);

    var deskTop = r.y + r.h - 12;   // 책상 상판 y
    var cx = r.x + r.w / 2;

    // 벽면 데코 (방마다 다르게)
    if (idx % 3 === 0) windowPanel(g, r.x + 6, r.y + 2.2, 22, 8);
    else if (idx % 3 === 1) {
      R(g, r.x + 6, r.y + 2.6, 16, 9, '#141d31');
      R(g, r.x + 6.6, r.y + 3.2, 14.8, 7.8, '#0e1728');
      R(g, r.x + 8, r.y + 4.4, 5, 0.8, 'rgba(60,224,255,.5)');
      R(g, r.x + 8, r.y + 6.2, 8, 0.8, 'rgba(255,209,102,.45)');
      R(g, r.x + 8, r.y + 8, 6.4, 0.8, 'rgba(74,222,128,.45)');
      R(g, r.x + 8, r.y + 9.8, 9.6, 0.8, 'rgba(167,139,250,.4)');
    } else shelf(g, r.x + 5, r.y + 2.4, 12, 10);

    // 시계 / 포스터
    R(g, r.x + r.w - 20, r.y + 2.4, 7, 7, '#0d1728');
    R(g, r.x + r.w - 19.4, r.y + 3, 5.8, 5.8, '#dbe7f7');
    R(g, r.x + r.w - 17, r.y + 4, 1, 2.4, '#2b3a56');
    R(g, r.x + r.w - 17, r.y + 5.4, 1.8, 0.8, '#2b3a56');
    plant(g, r.x + r.w - 13, r.y + r.h - 12, 1);

    // 책상
    R(g, cx - 13, deskTop, 26, 5.6, C.wood);
    R(g, cx - 13, deskTop, 26, 1.6, C.wood3);
    R(g, cx - 13, deskTop, 26, 0.6, '#b08a63');
    R(g, cx - 11, deskTop + 5.6, 2, 2, '#3d2a1e');
    R(g, cx + 9, deskTop + 5.6, 2, 2, '#3d2a1e');
    // 키보드
    R(g, cx - 7, deskTop + 2.4, 8, 1.2, '#2b3448');
    R(g, cx - 7, deskTop + 2.4, 8, 0.5, '#3d4a66');
    // 모니터
    var mx = cx + 3;
    R(g, mx, deskTop - 3.4, 1.6, 3.4, '#2b3448');
    R(g, mx - 2.4, deskTop + 0.2, 6.4, 0.8, '#2b3448');
    R(g, mx - 6, deskTop - 9, 12, 6.2, '#111a2b');
    R(g, mx - 5.4, deskTop - 8.4, 10.8, 5, '#0b2f33');
    R(g, mx - 4.6, deskTop - 7.6, 3.6, 0.8, 'rgba(46,230,200,.85)');
    R(g, mx - 4.6, deskTop - 6.2, 6.4, 0.8, 'rgba(46,230,200,.45)');
    R(g, mx - 4.6, deskTop - 4.8, 4.8, 0.8, 'rgba(46,230,200,.6)');
    // 서류/컵
    R(g, cx - 11.5, deskTop + 1.8, 3.2, 3, '#e8eefc');
    R(g, cx - 11.5, deskTop + 1.8, 3.2, 0.7, '#b9c8e0');
    R(g, cx + 17, deskTop + 1.4, 2.6, 2.6, '#c96a4a');
    // 의자
    R(g, cx - 5, deskTop - 8.5, 10, 9, '#1b2436');
    R(g, cx - 4, deskTop - 8, 8, 8, '#26324a');
    R(g, cx - 4, deskTop - 8, 8, 1.2, '#38486a');
  }

  /* ---------------------------------------------------------------- 탕비실 */
  function drawPantry(g) {
    var r = ROOMS.pantry, wallH = 9;
    R(g, r.x, r.y, r.w, r.h, '#242b38');
    // 타일 바닥
    for (var ty = r.y + wallH; ty < r.y + r.h; ty += 4) {
      for (var tx = r.x; tx < r.x + r.w; tx += 4) {
        var odd = ((tx - r.x) / 4 + (ty - r.y - wallH) / 4) % 2 === 0;
        R(g, tx, ty, 4, 4, odd ? '#262d3b' : '#1f2531');
      }
    }
    R(g, r.x, r.y, r.w, wallH, '#2a3243');
    R(g, r.x, r.y + wallH - 1, r.w, 1, '#161d29');
    R(g, r.x, r.y, r.w, 1, 'rgba(255,255,255,.06)');

    // 카운터
    R(g, r.x + 5, r.y + 9, 46, 7, '#39445c');
    R(g, r.x + 5, r.y + 9, 46, 2.4, '#4d5b78');
    R(g, r.x + 5, r.y + 16, 46, 1, '#1a2232');
    // 커피머신
    R(g, r.x + 8, r.y + 3, 10, 8, '#2b3446');
    R(g, r.x + 8, r.y + 3, 10, 2, '#3b475e');
    R(g, r.x + 9.4, r.y + 5.2, 7, 4, '#141c2a');
    R(g, r.x + 10.4, r.y + 9.6, 5, 1.4, '#151d2b');
    R(g, r.x + 15.2, r.y + 4, 1.4, 1.4, '#ff6b6b');
    R(g, r.x + 9.8, r.y + 6.2, 6, 0.8, 'rgba(60,224,255,.35)');
    // 컵
    R(g, r.x + 10.6, r.y + 12, 2.4, 2.4, '#e8eefc');
    // 싱크대
    R(g, r.x + 26, r.y + 6.4, 11, 3, '#8b97a6');
    R(g, r.x + 27, r.y + 7, 9, 2, '#5d6879');
    R(g, r.x + 30, r.y + 4.6, 1, 2, '#9aa6b6');
    // 냉장고
    R(g, r.x + 55, r.y + 2.4, 13, 14, '#3a4459');
    R(g, r.x + 55, r.y + 2.4, 13, 0.8, '#4e5c78');
    R(g, r.x + 55, r.y + 8, 13, 0.8, '#232b3b');
    R(g, r.x + 65.6, r.y + 5, 1, 2.4, '#8b97a6');
    R(g, r.x + 65.6, r.y + 9.6, 1, 2.6, '#8b97a6');
    // 프린터
    R(g, r.x + 88, r.y + 8.4, 20, 8, '#39445c');
    R(g, r.x + 88, r.y + 8.4, 20, 2, '#4d5b78');
    R(g, r.x + 90, r.y + 6.4, 16, 2.4, '#2c3547');
    R(g, r.x + 93, r.y + 11.6, 8, 1.4, '#e8eefc');
    R(g, r.x + 92, r.y - 0.6, 0.8, 0.8, '#4ade80');
    // 소파
    R(g, r.x + 136, r.y + 12, 26, 9, '#3b2b3f');
    R(g, r.x + 136, r.y + 10, 26, 3.4, '#4a3550');
    R(g, r.x + 137.6, r.y + 13.4, 10, 6, '#553d5c');
    R(g, r.x + 149.6, r.y + 13.4, 10, 6, '#553d5c');
    // 커피 테이블
    R(g, r.x + 143, r.y + 23, 12, 3, '#4a3527');
    R(g, r.x + 143, r.y + 23, 12, 1, '#6b4a33');
    // 화분
    plant(g, r.x + 126, r.y + 14, 1);
    plant(g, r.x + 166, r.y + 8, 1.1);
    // 벽시계
    R(g, r.x + 116, r.y + 2, 7, 7, '#0d1728');
    R(g, r.x + 116.6, r.y + 2.6, 5.8, 5.8, '#dbe7f7');
    R(g, r.x + 119, r.y + 3.6, 1, 2.6, '#2b3a56');
    R(g, r.x + 119, r.y + 5.4, 2, 0.8, '#2b3a56');
  }

  /* ================================================================ 봇 */
  function makeBot(o) {
    return {
      id: o.id, home: o.home, seat: { x: o.x, y: o.y },
      x: o.x, y: o.y, dir: 1, walkPhase: 0, walking: false,
      shirt: o.shirt || '#3ce0ff', hair: o.hair || '#241a14',
      skin: o.skin || SKINS[0], kind: o.kind || 'dept',
      state: 'work', t: 0, next: rnd(5, 13), path: [], onArrive: null,
      carry: false, phase: rnd(0, 6), celebrate: 0
    };
  }

  function initBots() {
    bots = [];
    var depts = DATA.departments || [];
    deptList = depts;

    depts.forEach(function (d, i) {
      var r = ROOMS[d.room] || ROOMS.economy;
      var deskTop = r.y + r.h - 12;
      var b = makeBot({
        id: d.id, home: d.room, x: r.x + r.w / 2 - 1, y: deskTop + 1,
        shirt: SHIRTS[d.id] || '#3ce0ff', hair: HAIRS[d.id] || '#241a14',
        skin: SKINS[i % SKINS.length], kind: 'dept'
      });
      b.seat = { x: r.x + r.w / 2 - 1, y: deskTop + 1 };
      b.dept = d;
      bots.push(b);
    });

    // 회의실 팀장 3
    var leads = [
      { x: ROOMS.meet.x + 26, y: ROOMS.meet.y + 24 },
      { x: ROOMS.meet.x + 50, y: ROOMS.meet.y + 24 },
      { x: ROOMS.meet.x + 36, y: ROOMS.meet.y + 43 }
    ];
    leads.forEach(function (p, i) {
      var b = makeBot({ id: 'lead' + i, home: 'meet', x: p.x, y: p.y, shirt: i === 1 ? '#8fb3ff' : '#7aa2e8', hair: ['#2b2018', '#241a14', '#1f2733'][i], kind: 'lead', skin: SKINS[(i + 1) % 3] });
      b.state = 'meet'; b.next = 999; b.faceUp = i === 2;
      bots.push(b);
    });

    // 탕비실 2
    var rests = [
      { x: ROOMS.pantry.x + 24, y: ROOMS.pantry.y + 16 },
      { x: ROOMS.pantry.x + 152, y: ROOMS.pantry.y + 21 }
    ];
    rests.forEach(function (p, i) {
      var b = makeBot({ id: 'rest' + i, home: 'pantry', x: p.x, y: p.y, shirt: ['#9aa6b6', '#c98a6b'][i], hair: ['#33261a', '#1f2733'][i], kind: 'rest', skin: SKINS[i] });
      b.state = 'coffee'; b.next = 999;
      bots.push(b);
    });

    // 대표
    var ceo = makeBot({
      id: 'ceo', home: 'ceo', x: ROOMS.ceo.x + 37, y: ROOMS.ceo.y + 33,
      shirt: '#20263a', hair: '#1b1b1b', kind: 'ceo', skin: '#f2c69b'
    });
    ceo.state = 'ceo'; ceo.next = 999;
    bots.push(ceo);

    trayPapers = 0;
  }

  /* ---------------------------------------------------------------- 이동 */
  var SPEED = 15;
  function walk(b, dt) {
    if (!b.path.length) { b.walking = false; if (b.onArrive) { var f = b.onArrive; b.onArrive = null; f(); } return; }
    var dist = SPEED * dt;
    b.walking = true;
    var guard = 0;
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
    meet: [{ x: ROOMS.meet.x + 20, y: ROOMS.meet.y + 43 }, { x: ROOMS.meet.x + 56, y: ROOMS.meet.y + 43 }, { x: ROOMS.meet.x + 12, y: ROOMS.meet.y + 38 }],
    pantry: [{ x: ROOMS.pantry.x + 34, y: ROOMS.pantry.y + 18 }, { x: ROOMS.pantry.x + 84, y: ROOMS.pantry.y + 17 }, { x: ROOMS.pantry.x + 126, y: ROOMS.pantry.y + 20 }],
    ceo: [{ x: ROOMS.ceo.x + 60, y: ROOMS.ceo.y + 44 }]
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
    var from = { x: b.x, y: b.y };
    var path = exitPath(b.home, from);
    var target = sp.p;
    path = path.concat(enterPath(kind, target));
    b.path = path;
    b.spot = sp;
    b.carry = kind === 'ceo';
    b.state = 'walk';
    b.onArrive = function () {
      b.state = kind === 'ceo' ? 'deliver' : (kind === 'meet' ? 'meet' : 'coffee');
      b.t = 0;
      b.next = kind === 'ceo' ? 1.8 : rnd(7, 11);
      b.spotKey = kind;
    };
    return true;
  }

  function goHome(b) {
    var from = { x: b.x, y: b.y };
    var path = exitPath(b.spotKey || b.home, from);
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
        var tray = { x: ROOMS.ceo.x + 50, y: ROOMS.ceo.y + 31 };
        effects.push({ kind: 'paper', x: b.x + 3, y: b.y - 9, tx: tray.x, ty: tray.y, t: 0, dur: 0.85 });
        if (trayPapers < 7) trayPapers++;
        stampFlash = 1;
      }
      if (b.t > b.next) { b.delivered = false; goHome(b); }
      return;
    }
    if (b.state === 'meet') {
      if (b.t > b.next) goHome(b);
      return;
    }
    if (b.state === 'coffee') {
      if (b.t > b.next) goHome(b);
      return;
    }
    if (b.state === 'ceo') {
      // 도장 / 서류 들기
      stampT += dt;
      if (stampT > 5.5) { stampT = 0; stampFlash = 1; if (trayPapers < 7) trayPapers++; }
      return;
    }
  }

  /* ---------------------------------------------------------------- 스프라이트 */
  function drawBot(g, b, opts) {
    opts = opts || {};
    var x = Math.round(b.x), y = Math.round(b.y);
    var bob = (b.state === 'work' || b.state === 'ceo' || b.state === 'meet') ? (Math.sin((b.t || performance.now() / 1000) * 2.2 + (b.phase || 0)) > 0 ? 0 : 1) : 0;
    var step = b.walking ? (Math.floor(b.walkPhase) % 2) : 0;
    var sit = !!opts.sit;

    // 그림자
    R(g, x - 3, y - 1, 7, 1, 'rgba(0,0,0,.35)');
    if (!sit) {
      if (b.walking) {
        R(g, x - 2, y - 4, 2, 3 - step, '#1e2838');
        R(g, x + 1, y - 4, 2, 3 - (1 - step), '#1e2838');
        R(g, x - 3, y - 1 - step, 2, 2, '#0d1220');
        R(g, x + 1, y - 2 + step, 2, 2, '#0d1220');
      } else {
        R(g, x - 2, y - 4, 2, 3, '#1e2838');
        R(g, x + 1, y - 4, 2, 3, '#1e2838');
        R(g, x - 3, y - 2, 2, 2, '#0d1220');
        R(g, x + 1, y - 2, 2, 2, '#0d1220');
      }
    }
    // 몸통
    R(g, x - 3, y - 10, 6, 6 + bob * 0, b.shirt);
    R(g, x - 3, y - 10, 6, 1.2, 'rgba(255,255,255,.18)');
    R(g, x - 1, y - 10, 2, 6, 'rgba(0,0,0,.10)');
    // 팔
    var armOff = 0;
    if (b.state === 'work') armOff = (Math.floor(performance.now() / 170 + (b.phase || 0)) % 2) ? 1 : 0;
    R(g, x - 4, y - 9 + armOff, 1.4, 3, b.shirt);
    R(g, x + 3, y - 9 + (1 - armOff), 1.4, 3, b.shirt);
    R(g, x - 4, y - 6 + armOff, 1.4, 1.4, b.skin);
    R(g, x + 3, y - 6 + (1 - armOff), 1.4, 1.4, b.skin);
    // 머리
    R(g, x - 3, y - 15, 6, 5, b.skin);
    R(g, x - 3, y - 15, 6, 1.6, b.hair);
    R(g, x - 3, y - 14, 1.2, 2.6, b.hair);
    R(g, x + 1.8, y - 14, 1.2, 2.6, b.hair);
    // 눈
    var eo = b.dir > 0 ? 0 : 0;
    R(g, x - 2 + eo, y - 12.4, 1, 1, '#10161f');
    R(g, x + 1 + eo, y - 12.4, 1, 1, '#10161f');
    // 목
    R(g, x - 1, y - 10.4, 2, 1, 'rgba(0,0,0,.18)');

    if (b.kind === 'ceo') {
      // 왕관
      R(g, x - 3, y - 17.4, 6, 1.6, '#ffd166');
      R(g, x - 3, y - 18.4, 1.4, 1.4, '#ffd166');
      R(g, x - 0.7, y - 18.8, 1.4, 1.8, '#ffe9a8');
      R(g, x + 1.6, y - 18.4, 1.4, 1.4, '#ffd166');
      // 넥타이
      R(g, x - 0.6, y - 9.4, 1.2, 4.4, '#c0392b');
    }
    if (b.carry) {
      R(g, x + 3.4, y - 9.6, 3, 4, '#e8eefc');
      R(g, x + 3.9, y - 8.8, 2, 0.6, '#a9bbd6');
      R(g, x + 3.9, y - 7.6, 1.6, 0.6, '#a9bbd6');
    }
    if (b.kind === 'lead') R(g, x - 0.6, y - 9.6, 1.2, 4, '#1f2a3f');
  }

  /* ---------------------------------------------------------------- 동적 렌더 */
  function paint(now) {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(staticCanvas, 0, 0);

    var g = ctx;
    var ts = now / 1000;

    // 모니터 빛
    deptList.forEach(function (d, i) {
      var r = ROOMS[d.room]; if (!r) return;
      var cx = r.x + r.w / 2;
      var fl = 0.05 + 0.045 * Math.sin(ts * 3 + i);
      R(g, cx - 3, r.y + r.h - 21, 12, 9, 'rgba(46,230,200,' + fl.toFixed(3) + ')');
    });

    // 대표 서류 트레이
    for (var p = 0; p < trayPapers; p++) {
      R(g, ROOMS.ceo.x + 47 + p * 0.25, ROOMS.ceo.y + 30.4 - p * 0.9, 6, 1, p % 2 ? '#e8eefc' : '#dbe6f7');
      R(g, ROOMS.ceo.x + 47 + p * 0.25, ROOMS.ceo.y + 30.4 - p * 0.9, 6, 0.4, '#b9c8e0');
    }
    // 도장 불빛
    if (stampFlash > 0) {
      stampFlash = Math.max(0, stampFlash - 0.03);
      R(g, ROOMS.ceo.x + 34, ROOMS.ceo.y + 30, 8, 6, 'rgba(255,209,102,' + (stampFlash * 0.35).toFixed(3) + ')');
    }
    // 탕비실 김
    var steam = (ts * 1.4) % 3;
    R(g, ROOMS.pantry.x + 11.4, ROOMS.pantry.y + 11.6 - steam, 1.2, 1.2, 'rgba(220,235,255,.22)');
    R(g, ROOMS.pantry.x + 12.2, ROOMS.pantry.y + 13 - steam, 1, 1, 'rgba(220,235,255,.14)');

    // 봇 (아래쪽 y 먼저)
    var order = bots.slice().sort(function (a, b) { return a.y - b.y; });
    for (var i = 0; i < order.length; i++) {
      var b = order[i];
      if (b.kind === 'ceo') continue;
      var sit = (b.state === 'work' || b.state === 'meet' || (b.state === 'coffee' && b.home === 'pantry'));
      drawBot(g, b, { sit: sit && !b.walking });
    }
    // 대표는 책상 뒤 → 책상보다 먼저 그리지만 책상은 정적 레이어에 이미 있음
    var ceo = bots.find(function (x) { return x.kind === 'ceo'; });
    if (ceo) {
      // 인물을 책상 위에 반쯤 가리도록 별도 레이어 없이 그대로 그린다
      drawBot(g, ceo, { sit: true });
      // 도장질
      var st = (ts % 5.5);
      if (st < 0.5) {
        R(g, ceo.x + 3, ceo.y - 9, 1.6, 3, '#c0392b');
        R(g, ceo.x + 2.4, ceo.y - 6, 2.8, 1.4, '#8e2a20');
      }
    }

    // 효과: 서류 날아가기
    for (var e = effects.length - 1; e >= 0; e--) {
      var f = effects[e];
      f.t += 1 / 60;
      var k = Math.min(1, f.t / f.dur);
      var px = f.x + (f.tx - f.x) * k;
      var py = f.y + (f.ty - f.y) * k - Math.sin(k * Math.PI) * 5;
      R(g, px, py, 3, 3.6, '#e8eefc');
      R(g, px, py, 3, 0.8, '#b9c8e0');
      if (k >= 1) effects.splice(e, 1);
    }
  }

  /* ---------------------------------------------------------------- 오버레이 */
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

    // 대표실 / 회의실 / 탕비실 라벨
    [
      { r: ROOMS.ceo, icon: '👑', text: '대표실 · 각하', cls: '' },
      { r: ROOMS.meet, icon: '🗣️', text: '회의실 · 팀장 검증', cls: '' },
      { r: ROOMS.pantry, icon: '☕', text: '탕비실', cls: '' }
    ].forEach(function (o) {
      var d = document.createElement('div');
      d.style.position = 'absolute';
      d.style.left = (o.r.x / VW * 100) + '%';
      d.style.top = (o.r.y / VH * 100) + '%';
      d.style.width = (o.r.w / VW * 100) + '%';
      d.style.height = (o.r.h / VH * 100) + '%';
      d.style.pointerEvents = 'none';
      d.innerHTML = '<span class="room-tag">' + o.icon + ' ' + o.text + '</span>';
      $('#overlay').appendChild(d);
    });

    // 대표실 결재 배지
    var ap = (DATA.approvals || []).length;
    if (ap) {
      var badge = document.createElement('div');
      badge.style.position = 'absolute';
      badge.style.left = ((ROOMS.ceo.x + ROOMS.ceo.w) / VW * 100) + '%';
      badge.style.top = ((ROOMS.ceo.y + 6) / VH * 100) + '%';
      badge.style.transform = 'translateX(-100%)';
      badge.style.pointerEvents = 'none';
      badge.innerHTML = '<span class="room-bubble wait" style="position:static;display:inline-block">결재 ' + ap + '</span>';
      $('#overlay').appendChild(badge);
    }

    applySelection();
  }

  function applySelection() {
    document.querySelectorAll('.room-hit').forEach(function (el) {
      el.classList.toggle('sel', el.dataset.dept === selected);
    });
  }

  /* ---------------------------------------------------------------- 패널 */
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
      '<p class="note">각하 결정은 앱에서 지시하면 그대로 처리된다 · 옵션은 참고용 표시</p>';

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
    $('#stamp').textContent = '마지막 갱신 ' + (DATA.updated || '').replace('T', ' ').slice(0, 16);

    renderDetail();
  }

  function stateLabel(s) {
    if (s === 'ok') return '완료';
    if (s === 'wait') return '결재대기';
    return '진행중';
  }

  function renderDetail() {
    var body = $('#detailBody');
    var hint = $('#detailHint');
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
    if (selected === id) { selected = null; } else { selected = id; }
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

  /* ---------------------------------------------------------------- 데이터 */
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

  function boot(data, isFallback) {
    DATA = data;
    buildOverlay();
    renderPanels();
    initBots();
  }

  function loadData(first) {
    fetch('./data.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) {
        if (!d || !d.departments) throw new Error('bad json');
        if (first) boot(d, false);
        else {
          var keep = selected;
          DATA = d;
          buildOverlay(); renderPanels(); initBots();
          selected = keep; applySelection(); renderDetail();
        }
      })
      .catch(function (e) {
        if (first) {
          boot(FALLBACK, true);
          var b = document.createElement('div');
          b.className = 'err';
          b.textContent = 'office/data.json 을 불러오지 못했습니다 (' + e.message + '). 부서 이름만 표시합니다.';
          document.querySelector('.stage').appendChild(b);
        }
      });
  }

  /* ---------------------------------------------------------------- 루프 */
  function loop(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    try {
      for (var i = 0; i < bots.length; i++) updateBot(bots[i], dt);
      paint(now);
    } catch (err) { /* 렌더 루프는 계속 돈다 */ }
    rafId = requestAnimationFrame(loop);
  }

  function clockTick() {
    var d = new Date();
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    var ss = String(d.getSeconds()).padStart(2, '0');
    $('#clock').textContent = hh + ':' + mm + ':' + ss;
  }

  /* ---------------------------------------------------------------- 시작 */
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
      if (hit && hit.dataset.dept) {
        selectDept(hit.dataset.dept, hit.classList.contains('room-hit'));
      }
    });

    loadData(true);
    setInterval(function () { loadData(false); }, 300000);
    loop(performance.now());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
