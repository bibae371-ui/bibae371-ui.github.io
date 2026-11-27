/* 당버지 AI 오피스 — 탭 UI
 * 오피스 맵 / 회의실 / 작업실 / 부서현황 / 메모
 * 데이터는 ./data.json 하나만 고치면 된다. 지도 캔버스는 pixelmap.js 담당.
 */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }
  function num(n) {
    if (n === null || n === undefined || n === '') return '—';
    return Number(n).toLocaleString('ko-KR');
  }
  function mention(txt) {
    return esc(txt).replace(/@([가-힣A-Za-z0-9_]+)/g, '<span class="mention">@$1</span>');
  }

  /* ------------------------------------------------------------ 고정 라벨 */
  var TEAMS = {
    secretary: { name: '비서실장', icon: '🧭', role: '총괄' },
    economy:   { name: '경제팀장', icon: '📈', role: '경제·X팀' },
    health:    { name: '건강팀장', icon: '🏥', role: '건강·공포팀' },
    tistory:   { name: '티스토리팀장', icon: '🍯', role: '티스토리' },
    dayeon:    { name: '다연돈팀장', icon: '🎭', role: '다연돈팀' },
    global:    { name: '해외팀장', icon: '🇧🇷', role: '해외수면팀' },
    local:     { name: '로컬팀장', icon: '🔮', role: '로컬직판팀' },
    finance:   { name: '재무팀장', icon: '💰', role: '재무·스폰서팀' },
    webtools:  { name: '웹도구팀장', icon: '🛠️', role: '웹도구팀' }
  };
  var ROOMS = { hall: '🏛️ 대회의실', ceo: '👑 지휘실', lounge: '☕ 라운지', team: '💼 부서별' };

  /* 회의실 피드 — data.json 에 meeting[] 이 없으면 이 내용을 쓴다 (같은 문장) */
  var MEETING_FB = [
    { room: 'ceo', team: 'secretary', t: '11:42', text: '@각하 결재 대기 2건입니다. Ducat $400 X 교육 원고 초안, 세후로 40만 원 결제·서류 4종입니다.' },
    { room: 'hall', team: 'tistory', t: '11:44', text: '@all 티스토리 11/28 09:00 슬롯을 로또 실전 글로 교체해 뒀습니다. 제목·본문 3,997자·태그 10까지 완료.' },
    { room: 'lounge', team: 'dayeon', t: '11:40', text: '커피 한 잔 하고 11시 발행분 보러 갑니다.' },
    { room: 'lounge', team: 'secretary', t: '11:39', text: '@웹도구팀장 배포되면 모바일 390px부터 확인해 주세요.' },
    { room: 'lounge', team: 'webtools', t: '11:38', text: '오피스 화면 탭으로 나누는 작업 들어갑니다. 끝나면 회의실에 올립니다.' },
    { room: 'team', team: 'finance', t: '11:24', text: '5채널 유입은 있는데 신규 매출 0원입니다. 애드포스트 잔액 3원·애드센스 $0.00 유지.' },
    { room: 'ceo', team: 'finance', t: '11:23', text: '@비서실장 세후로 견적서 발송 끝났습니다. 결제와 서류 4종만 남았습니다.' },
    { room: 'team', team: 'local', t: '11:22', text: '@비서실장 당근 캐시백 5,000원 환급 완료했습니다. 광고캐시 5,000원·30일, 현금 인출은 안 됩니다.' },
    { room: 'ceo', team: 'secretary', t: '10:40', text: '@각하 10시 실측 5채널 어제 확정 412뷰, 오늘 10시까지 115뷰입니다. 신규 매출은 0원입니다.' },
    { room: 'team', team: 'global', t: '10:36', text: '8탄 10:50 조회 1입니다. 최근 4편이 0~20회로 노출이 안 잡힙니다.' },
    { room: 'team', team: 'dayeon', t: '10:31', text: '@비서실장 공개 카운터 오늘 24·전체 165,903·이웃 1,058입니다. 11:00 발행분은 로그인 금지라 미확인입니다.' },
    { room: 'team', team: 'health', t: '10:28', text: '킹덤 11/26 39뷰·검색 78.38%입니다. 오늘 13뷰, 12:30 지방간 글 대기 중입니다.' },
    { room: 'team', team: 'tistory', t: '10:28', text: '티스토리 11/26 21뷰(+75%)로 2주 최고입니다. 09:00 키 공통점 글 공개했습니다.' },
    { room: 'team', team: 'economy', t: '10:24', text: '@비서실장 예약 41건 유지 확인했습니다. 오늘 18:30 목마사지기 발행 대기입니다.' },
    { room: 'team', team: 'economy', t: '10:18', text: '애드포스트 「검수중」 24시간째입니다. 킹원 미디어 노출은 아직 0입니다.' },
    { room: 'team', team: 'economy', t: '10:12', text: '@비서실장 킹원 11/26 확정 306뷰 마감했습니다. 검색 유입 53.67%로 메인 40.00%를 처음 넘겼습니다.' },
    { room: 'hall', team: 'global', t: '09:05', text: '@all 8탄 「Salmo 63 7 Vezes」 야간 배경으로 공개했습니다.' },
    { room: 'hall', team: 'secretary', t: '09:02', text: '@all 오늘 순서 공유합니다. 12:30 지방간 → 18:30 목마사지기 → 11/28 09:00 로또. 결재 2건은 대표 확인 뒤 진행합니다.' },
    { room: 'hall', team: 'economy', t: '08:31', text: '@all 08:30 「변호사 회계사 세무사 평균 소득」 정상 공개했습니다.' }
  ];

  var CHAN_FB = [
    { name: 'kingwon1633', tag: '네이버 ① 경제', icon: '📈', today: 78, todayAt: '10:12', yesterday: 306, unit: '뷰', note: '검색 54.80% · 예약 41건', status: 'run' },
    { name: 'smart_actor', tag: '네이버 ② 다연돈', icon: '🎭', today: 24, todayAt: '11:40', yesterday: 46, unit: '뷰', note: '전체 165,903 · 애드포스트 412노출·클릭 0', status: 'run' },
    { name: 'kingdom1541', tag: '네이버 ③ 의사', icon: '🏥', today: 13, todayAt: '10:38', yesterday: 39, unit: '뷰', note: '검색 78.38% · 예약 29건', status: 'run' },
    { name: '티스토리', tag: '꿀통 고객센터', icon: '🍯', today: null, todayAt: '', yesterday: 21, unit: '뷰', note: '(+75%) 2주 최고 · 오늘 09:00 공개분 미집계', status: 'ok' },
    { name: '희망당', tag: '당근 비즈', icon: '🔮', today: 0, todayAt: '11:40', yesterday: 0, unit: '조회', note: '4일 연속 0 · 30일 124회 · 단골 3', status: 'wait' }
  ];

  var DATA = null;
  var TAB = 'map', VIEW = 'clay', selected = null;
  var mRoom = 'all', mTeam = 'all', wTab = 'todo';

  /* ============================================================ 탭 */
  function showTab(name) {
    TAB = name;
    $$('.tab').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === name); });
    $$('.pane').forEach(function (p) { p.classList.toggle('on', p.id === 'pane-' + name); });
    if (name === 'map') applyView(VIEW, true);
    window.scrollTo(0, 0);
  }

  function applyView(v) {
    VIEW = v;
    $$('#viewSeg button').forEach(function (b) {
      var on = b.dataset.view === v;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    $('#clayView').classList.toggle('hidden', v !== 'clay');
    $('#pixelView').classList.toggle('hidden', v !== 'pixel');
    $('#stageFoot').innerHTML = v === 'pixel'
      ? '<span><i class="dot b"></i>진행중</span><span><i class="dot g"></i>완료</span><span><i class="dot y"></i>결재·대기</span><span class="sp">픽셀 맵 · 방을 누르면 상세</span>'
      : '<span><i class="dot b"></i>가동</span><span><i class="dot g"></i>완료</span><span><i class="dot y"></i>결재·대기</span><span class="sp">배지를 누르면 상세</span>';
    if (v === 'pixel' && window.PixelOffice) {
      setTimeout(function () { window.PixelOffice.relayout(); }, 40);
    }
  }

  /* ============================================================ 선택 */
  function isDept(id) {
    return !!(DATA && (DATA.departments || []).some(function (d) { return d.id === id; }));
  }

  function select(room) {
    selected = (selected === room) ? null : room;
    if (window.PixelOffice) window.PixelOffice.select(isDept(selected) ? selected : null);
    $$('#roomChips .chip').forEach(function (c) { c.classList.toggle('on', c.dataset.room === selected); });
    $$('.hot').forEach(function (h) { h.classList.toggle('on', h.dataset.room === selected); });
    renderDetail();
    if (selected && window.innerWidth < 940) {
      var el = $('#detailPanel');
      var top = el.getBoundingClientRect().top + window.scrollY - 96;
      if (window.scrollY + window.innerHeight < top + 60) window.scrollTo({ top: top, behavior: 'smooth' });
    }
  }

  function statusLabel(s) {
    return s === 'ok' ? '완료' : s === 'wait' ? '대기' : '진행중';
  }

  /* ============================================================ 오피스 맵 */
  function renderMap() {
    var ceo = DATA.ceo || {};
    var depts = DATA.departments || [];
    var ap = (DATA.approvals || []).length;

    $('#heroTitle').textContent = '대표 지휘실 · ' + (ceo.name || '대표');
    $('#heroNote').textContent = ceo.note || DATA.headline || '';
    $('#heroBadge').textContent = '결재 ' + ap + '건';
    $('#hotAp').textContent = '결재 ' + ap;
    $('#hotAp').className = 'hs' + (ap ? '' : ' run');
    $('#mapStat').textContent = '방 ' + (depts.length + 3) + ' · 봇 ' + ((DATA.stats && DATA.stats.bots) || 13) + '명';
    $('#headline').textContent = DATA.headline || '';

    /* 방·부서 칩 */
    var chips = [
      { room: 'ceo', label: '👑 지휘실' },
      { room: 'meet', label: '🏛️ 대회의실' }
    ].concat(depts.map(function (d) {
      return { room: d.id, label: (d.icon || '') + ' ' + d.name, dot: d.status };
    })).concat([{ room: 'lounge', label: '☕ 라운지' }]);

    $('#roomChips').innerHTML = chips.map(function (c) {
      return '<button type="button" class="chip' + (selected === c.room ? ' on' : '') + '" data-room="' + esc(c.room) + '">' +
        (c.dot ? '<i class="' + esc(c.dot) + '"></i>' : '') + esc(c.label) + '</button>';
    }).join('');

    /* 오늘의 처리 (예약 큐 모음) */
    var q = [];
    depts.forEach(function (d) {
      (d.queue || []).forEach(function (it) { q.push({ t: it.t || '—', text: it.text, d: d }); });
    });
    q.sort(function (a, b) { return String(a.t).localeCompare(String(b.t)); });
    $('#quickCnt').textContent = q.length;
    $('#quickBody').innerHTML = q.length
      ? '<ul class="tasks">' + q.slice(0, 7).map(function (it) {
          return '<li class="wait"><i></i><span><b style="font-weight:900;color:var(--wood)">' + esc(it.t) + '</b> ' +
            esc(it.text) + ' <span style="color:var(--muted2)">· ' + esc(it.d.name) + '</span></span></li>';
        }).join('') + '</ul>' +
        '<p class="note">예약·대기 항목만 모았습니다. 처리 결과는 작업실에서 확인합니다.</p>'
      : '<p class="none" style="font-size:11px;color:var(--muted)">예약된 작업이 없습니다.</p>';
  }

  function renderDetail() {
    var body = $('#detailBody'), hint = $('#detailHint'), title = $('#detailTitle');
    if (!DATA) return;
    var depts = DATA.departments || [];

    if (!selected || selected === 'dept') {
      title.textContent = '📋 부서 상세';
      hint.textContent = '방 선택';
      var rows = depts.map(function (d) {
        return '<button type="button" class="dept-row" data-room="' + esc(d.id) + '">' +
          '<span class="ic">' + esc(d.icon || '🏢') + '</span>' +
          '<span><span class="nm">' + esc(d.name) + '</span><span class="bb">' + esc(d.bubble || '') + '</span></span>' +
          '<span class="pc">' + (d.progress || 0) + '%</span></button>';
      }).join('');
      body.innerHTML =
        '<div class="dt-hd"><span class="nm">오피스 전체</span><span class="st run">가동중</span></div>' +
        '<div class="chips"><span>' + depts.length + '팀</span><span>봇 ' + ((DATA.stats && DATA.stats.bots) || 13) + '명</span>' +
        '<span>결재 ' + (DATA.approvals || []).length + '건</span></div>' +
        '<div style="margin-top:9px">' + rows + '</div>' +
        '<p class="note">팀을 누르면 상세가 열립니다.</p>';
      return;
    }

    if (selected === 'ceo') {
      title.textContent = '👑 대표 지휘실';
      hint.textContent = '결재 ' + (DATA.approvals || []).length;
      var ap = DATA.approvals || [];
      body.innerHTML =
        '<div class="dt-hd"><span class="nm">' + esc((DATA.ceo && DATA.ceo.name) || '대표') + '</span><span class="st wait">결재 대기</span>' +
        '<span class="dt-time">' + esc((DATA.ceo && DATA.ceo.note) || '') + '</span></div>' +
        (ap.length ? '<ul class="tasks">' + ap.map(function (a) {
          return '<li class="wait"><i></i><span><b style="font-weight:900">' + esc(a.title) + '</b> · ' + esc(a.meta) + '</span></li>';
        }).join('') + '</ul>' : '<p class="none" style="font-size:11px;color:var(--muted);margin-top:10px">결재 대기 없음</p>') +
        '<div class="links"><a href="#" data-goto="work">작업실에서 결재 보기</a></div>' +
        '<p class="note">결재는 앱에서 지시하면 그대로 처리됩니다.</p>';
      return;
    }

    if (selected === 'meet') {
      title.textContent = '🏛️ 대회의실';
      var q2 = [];
      depts.forEach(function (d) {
        (d.queue || []).forEach(function (it) { q2.push({ t: it.t || '—', text: it.text, d: d }); });
      });
      q2.sort(function (a, b) { return String(a.t).localeCompare(String(b.t)); });
      hint.textContent = '오늘 일정 ' + q2.length;
      body.innerHTML =
        '<div class="dt-hd"><span class="nm">오늘의 대회의실</span><span class="st run">공유중</span></div>' +
        '<div class="chips"><span>팀장 보고</span><span>예약 큐 ' + q2.length + '</span></div>' +
        (q2.length ? '<ul class="tasks">' + q2.map(function (it) {
          return '<li class="run"><i></i><span><b style="font-weight:900;color:var(--wood)">' + esc(it.t) + '</b> ' +
            esc(it.text) + ' <span style="color:var(--muted2)">· ' + esc(it.d.name) + '</span></span></li>';
        }).join('') + '</ul>' : '') +
        '<div class="links"><a href="#" data-goto="meet">회의실 대화 보기</a></div>' +
        '<p class="note">회의실 탭에서 팀장 보고를 방별로 볼 수 있습니다.</p>';
      return;
    }

    if (selected === 'lounge') {
      title.textContent = '☕ 라운지';
      var msgs = ((DATA.meeting && DATA.meeting.length) ? DATA.meeting : MEETING_FB)
        .filter(function (m) { return m.room === 'lounge'; }).slice(0, 3);
      hint.textContent = '휴게';
      body.innerHTML =
        '<div class="dt-hd"><span class="nm">라운지</span><span class="st ok">휴게중</span></div>' +
        '<div class="chips"><span>소파 · 커피</span><span>잠깐 숨 고르는 방</span></div>' +
        (msgs.length ? '<ul class="tasks">' + msgs.map(function (m) {
          var t = TEAMS[m.team] || { name: '팀장' };
          return '<li class="done"><i></i><span><b style="font-weight:900">' + esc(t.name) + '</b> ' + mention(m.text) + '</span></li>';
        }).join('') + '</ul>' : '') +
        '<p class="note">집중 업무는 각 부서 방에서, 잡담은 여기서.</p>';
      return;
    }

    var d = depts.filter(function (x) { return x.id === selected; })[0];
    if (!d) { selected = null; return renderDetail(); }

    title.textContent = '📋 부서 상세';
    hint.textContent = d.name;
    var links = (d.links || []).map(function (l) {
      return '<a href="' + esc(l.href) + '">' + esc(l.label) + '</a>';
    }).join('');
    var run = (d.tasks || []).filter(function (t) { return t.state === 'run'; });
    body.innerHTML =
      '<div class="dt-hd"><span class="nm">' + esc(d.icon || '') + ' ' + esc(d.name) + '</span>' +
      '<span class="st ' + esc(d.status || 'run') + '">' + statusLabel(d.status) + '</span>' +
      '<span class="dt-time">' + esc(d.updated || '') + ' 갱신</span></div>' +
      '<div class="chips">' + (d.channels || []).map(function (c) { return '<span>' + esc(c) + '</span>'; }).join('') + '</div>' +
      '<div class="bar ' + (d.status === 'wait' ? 'wait' : d.status === 'ok' ? 'ok' : '') + '"><i style="width:' +
        Math.max(4, Math.min(100, d.progress || 0)) + '%"></i></div>' +
      '<div class="pct"><span>진행률</span><span>' + (d.progress || 0) + '%</span></div>' +
      '<ul class="tasks">' + (d.tasks || []).map(function (t) {
        return '<li class="' + esc(t.state || 'run') + '"><i></i><span>' + esc(t.text) + '</span></li>';
      }).join('') + '</ul>' +
      (run.length ? '<p class="note">진행 중 ' + run.length + '건 · ' + esc(d.bubble || '') + '</p>' : '') +
      (links ? '<div class="links">' + links + '</div>' : '');
  }

  /* ============================================================ 회의실 */
  function renderFeed() {
    if (!DATA) return;
    var all = (DATA.meeting && DATA.meeting.length) ? DATA.meeting : MEETING_FB;
    var msgs = all.filter(function (m) {
      var roomOK = (mTeam === 'all') ? (mRoom === 'all' || m.room === mRoom) : true;
      var teamOK = (mTeam === 'all' || m.team === mTeam);
      return roomOK && teamOK;
    }).slice().sort(function (a, b) { return String(b.t).localeCompare(String(a.t)); });

    $('#meetCnt').textContent = msgs.length;
    var showRoom = (mRoom === 'all' && mTeam === 'all');

    $('#feed').innerHTML = msgs.length ? msgs.map(function (m) {
      var t = TEAMS[m.team] || { name: '팀장', icon: '💬', role: '부서' };
      return '<article class="msg' + (m.team === 'secretary' ? ' sec' : '') + '">' +
        '<div class="av" aria-hidden="true">' + t.icon + '</div>' +
        '<div>' +
          '<div class="mhead"><b>' + esc(t.name) + '</b>' +
            '<span class="role">' + esc(t.role) + '</span>' +
            (showRoom ? '<span class="role">' + esc(ROOMS[m.room] || '') + '</span>' : '') +
            '<time>' + esc(m.t) + '</time>' +
          '</div>' +
          '<div class="bubble">' + mention(m.text) + '</div>' +
        '</div></article>';
    }).join('') : '<div class="empty">이 방에는 아직 보고가 없습니다.<br>아래 @칩으로 다른 부서를 불러 보세요.</div>';
  }

  /* ============================================================ 작업실 */
  function renderWork() {
    if (!DATA) return;
    var ap = DATA.approvals || [], done = DATA.completed || [];
    $('#apCnt').textContent = ap.length;
    $('#apN').textContent = ap.length;
    $('#doneN').textContent = done.length;

    if (wTab === 'todo') {
      $('#workList').innerHTML = (ap.length ? ap.map(function (a) {
        return '<article class="ap' + (a.urgent ? ' urgent' : '') + '">' +
          '<span class="ico">' + esc(a.icon || '📄') + '</span>' +
          '<div><h3>' + esc(a.title) + (a.badge ? '<span class="dday">' + esc(a.badge) + '</span>' : '') + '</h3>' +
          '<p class="sub">' + esc(a.team) + ' · ' + esc(a.meta) + '</p>' +
          '<div class="opts">' + (a.options || []).map(function (o) { return '<span>' + esc(o) + '</span>'; }).join('') +
          (a.note ? '<span class="q">' + esc(a.note) + '</span>' : '') + '</div></div></article>';
      }).join('') : '<div class="empty">승인 대기 없음</div>') +
        '<p class="note">각 선택지는 참고 표시입니다. 결정은 앱에서 지시하면 처리됩니다.</p>';
    } else {
      $('#workList').innerHTML = done.length ? done.map(function (t) {
        var links = (t.links || []).map(function (l) {
          return '<a href="' + esc(l.href) + '">' + esc(l.label) + '</a>';
        }).join('');
        return '<article class="team"><h3>' + esc(t.icon || '') + ' ' + esc(t.team) + '<span class="ok">완료</span></h3>' +
          '<ul>' + (t.items || []).map(function (it) { return '<li>' + esc(it) + '</li>'; }).join('') + '</ul>' +
          (links ? '<div class="links">' + links + '</div>' : '') + '</article>';
      }).join('') : '<div class="empty">완료 항목 없음</div>';
    }

    /* 부서별 진행 · 예약 큐 */
    var depts = DATA.departments || [];
    var queueTotal = 0;
    depts.forEach(function (d) { queueTotal += (d.queue || []).length; });
    $('#deptN').textContent = depts.length + '팀 · 큐 ' + queueTotal;

    $('#board').innerHTML = depts.map(function (d, i) {
      var tasks = d.tasks || [];
      var run = tasks.filter(function (t) { return t.state === 'run'; });
      var wait = tasks.filter(function (t) { return t.state === 'wait'; });
      var doneT = tasks.filter(function (t) { return t.state === 'done'; });
      var queue = d.queue || [];
      function grp(kind, label, items, render) {
        if (!items.length) return '';
        return '<div class="grp"><h4>' + label + '<span class="k ' + kind + '">' + items.length + '</span></h4>' +
          '<ul>' + items.map(render).join('') + '</ul></div>';
      }
      var body =
        grp('run', '진행 중', run, function (t) { return '<li><span>' + esc(t.text) + '</span></li>'; }) +
        grp('queue', '예약 큐', queue, function (q) {
          return '<li><span class="t">' + esc(q.t || '—') + '</span><span>' + esc(q.text) + '</span></li>';
        }) +
        grp('done', '오늘 완료', doneT, function (t) { return '<li><span>' + esc(t.text) + '</span></li>'; }) +
        (wait.length ? '<div class="grp"><h4>대기 · 결재<span class="k queue">' + wait.length + '</span></h4><ul>' +
          wait.map(function (t) { return '<li><span class="g">·</span><span>' + esc(t.text) + '</span></li>'; }).join('') + '</ul></div>' : '');

      return '<details class="deptcard"' + (i === 0 ? ' open' : '') + '>' +
        '<summary><span class="ic">' + esc(d.icon || '🏢') + '</span>' +
        '<span><span class="nm">' + esc(d.name) + '</span><span class="sub">' + esc(d.bubble || '') +
        ' · 진행 ' + run.length + ' · 큐 ' + queue.length + ' · 완료 ' + doneT.length + '</span></span>' +
        '<span class="st ' + esc(d.status || 'run') + '">' + statusLabel(d.status) + '</span>' +
        '<span class="arrow">▾</span></summary>' +
        '<div class="body">' + (body || '<p class="none">진행 항목이 없습니다.</p>') + '</div></details>';
    }).join('');
  }

  /* ============================================================ 부서현황 */
  function renderStats() {
    if (!DATA) return;
    var chans = (DATA.channels && DATA.channels.length) ? DATA.channels : CHAN_FB;

    $('#chanGrid').innerHTML = chans.map(function (c) {
      var has = (c.today !== null && c.today !== undefined);
      var ratio = (has && c.yesterday) ? Math.min(100, Math.round(c.today / c.yesterday * 100)) : 0;
      var delta = '';
      if (has && c.yesterday) {
        var pct = Math.round((c.today - c.yesterday) / c.yesterday * 1000) / 10;
        var cls = pct > 0 ? 'up' : pct < 0 ? 'dn' : 'flat';
        delta = '<span class="delta ' + cls + '">' + (pct > 0 ? '+' : '') + pct + '%</span>';
      }
      return '<article class="chan">' +
        '<div class="top"><span>' + esc(c.icon || '📊') + '</span>' +
        '<span class="nm">' + esc(c.name) + '</span><span class="tg">' + esc(c.tag || '') + '</span>' +
        '<span class="st ' + esc(c.status || 'run') + '">' + statusLabel(c.status) + '</span></div>' +
        '<div class="nums"><span class="big">' + (has ? num(c.today) : '—') + '<small>' + esc(c.unit || '뷰') + '</small></span>' +
        delta + '<span class="cmp">어제 확정 <b>' + num(c.yesterday) + '</b></span></div>' +
        '<div class="track"><i style="width:' + ratio + '%"></i></div>' +
        '<div class="cap"><span>' + (has ? (c.todayAt ? c.todayAt + ' 기준' : '오늘') : '오늘 미집계') +
        ' · 어제의 ' + ratio + '%</span><span>' + esc(c.note || '') + '</span></div>' +
        '</article>';
    }).join('');

    var rev = DATA.revenue || [];
    $('#revCnt').textContent = rev.length;
    $('#revList').innerHTML = rev.map(function (r) {
      return '<div class="revrow"><span class="ic">' + esc(r.icon || '💳') + '</span>' +
        '<span><span class="nm">' + esc(r.name) + '</span><span class="note2">' + esc(r.note || '') + '</span></span>' +
        '<span class="v">' + esc(r.value) + '</span></div>';
    }).join('') || '<p class="none" style="font-size:11px;color:var(--muted)">수익 데이터가 없습니다.</p>';

    var d = new Date(DATA.updated || Date.now());
    $('#statsAt').textContent = tw(d.getHours()) + ':' + tw(d.getMinutes()) + ' 갱신';
  }

  function tw(n) { return String(n).padStart(2, '0'); }

  /* ============================================================ 메모 */
  function renderMemo() {
    if (!DATA) return;
    var memo = DATA.memo || {};
    var pr = memo.principles || [], bd = memo.boundaries || [], cl = memo.changelog || [];
    $('#memoPrinciples').innerHTML = pr.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
    $('#memoBounds').innerHTML = bd.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
    $('#changelog').innerHTML = cl.map(function (c) {
      return '<div class="row"><time>' + esc(c.t || '') + '</time><div>' +
        (c.v ? '<span class="v">' + esc(c.v) + '</span>' : '') + esc(c.text) + '</div></div>';
    }).join('');

    var logs = DATA.logs || [];
    $('#logList').innerHTML = logs.map(function (l) {
      return '<div><time>' + esc(l.t) + '</time><span>' + esc(l.text) + '</span></div>';
    }).join('');

    var d = new Date(DATA.updated || Date.now());
    $('#stamp').textContent = '마지막 갱신 ' + String(DATA.updated || '').replace('T', ' ').slice(0, 16);
    $('#clock').textContent = tw(d.getHours()) + ':' + tw(d.getMinutes()) + ':' + tw(d.getSeconds());
  }

  /* ============================================================ 렌더 전체 */
  function renderAll() {
    renderMap();
    renderDetail();
    renderFeed();
    renderWork();
    renderStats();
    renderMemo();
  }

  /* ============================================================ 이벤트 */
  function bind() {
    document.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t.closest) return;

      var tab = t.closest('.tab');
      if (tab) { showTab(tab.dataset.tab); return; }

      var view = t.closest('#viewSeg button');
      if (view) { applyView(view.dataset.view); return; }

      var hot = t.closest('.hot');
      if (hot) { select(hot.dataset.room); return; }

      var chip = t.closest('#roomChips .chip');
      if (chip) { select(chip.dataset.room); return; }

      var row = t.closest('.dept-row');
      if (row) { select(row.dataset.room); return; }

      var goto = t.closest('[data-goto]');
      if (goto) { ev.preventDefault(); showTab(goto.dataset.goto); return; }

      var mroom = t.closest('#roomTabs .chip');
      if (mroom) {
        mRoom = mroom.dataset.mroom;
        $$('#roomTabs .chip').forEach(function (c) { c.classList.toggle('on', c === mroom); });
        renderFeed(); return;
      }

      var mchip = t.closest('#mentionChips .mchip');
      if (mchip) {
        mTeam = mchip.dataset.team;
        $$('#mentionChips .mchip').forEach(function (c) { c.classList.toggle('on', c === mchip); });
        renderFeed(); return;
      }

      var wt = t.closest('#workSeg button');
      if (wt) {
        wTab = wt.dataset.wtab;
        $$('#workSeg button').forEach(function (b) { b.classList.toggle('on', b === wt); });
        renderWork(); return;
      }
    });
  }

  function clockTick() {
    var d = new Date();
    $('#clock').textContent = tw(d.getHours()) + ':' + tw(d.getMinutes()) + ':' + tw(d.getSeconds());
  }

  /* ============================================================ 데이터 */
  function boot(d) {
    DATA = d;
    if (window.PixelOffice) window.PixelOffice.init(d, select);
    applyView(VIEW);
    renderAll();
  }

  function load(first) {
    fetch('./data.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) {
        if (!d || !d.departments) throw new Error('bad json');
        if (first) boot(d);
        else {
          DATA = d;
          if (window.PixelOffice) window.PixelOffice.update(d);
          renderAll();
        }
      })
      .catch(function (e) {
        if (first) {
          DATA = {
            headline: 'data.json 로드 실패', updated: new Date().toISOString(),
            approvals: [], completed: [], logs: [], departments: [], channels: [], revenue: [], memo: {},
            ceo: { name: '대표', note: '' }
          };
          renderAll();
          $('#errBox').innerHTML = '<div class="err">office/data.json 을 불러오지 못했습니다 (' + esc(e.message) + ').</div>';
        }
      });
  }

  function start() {
    bind();
    clockTick();
    setInterval(clockTick, 1000);
    load(true);
    setInterval(function () { load(false); }, 300000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
