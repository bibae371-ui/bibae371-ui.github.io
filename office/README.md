# AI 오피스 현황판 (`/office/`)

탭 5개로 나눈 AI 오피스 대시보드.

| 탭 | 내용 |
|---|---|
| 🗺️ 오피스 맵 | 클레이 3D 오피스 이미지(`clay_office.png`) 위에 방·부서 배지와 실시간 상태 칩 → 클릭 시 상세. `기본`으로 바꾸면 픽셀아트 캔버스(봇 13명 애니메이션) |
| 💬 회의실 | 대회의실·지휘실·라운지·부서별 방별 팀장 보고 피드, 하단 `@all / @경제부 / @건강부 / @티스토리 / @다연돈 / @해외부` 필터 |
| 📋 작업실 | 대표 결재함(승인 대기·처리 완료) + 부서별 진행 중·예약 큐·오늘 완료 |
| 📊 부서현황 | 5대 채널 오늘 수치·어제 확정 대비 증감·애드포스트/애드센스 상태 |
| 📝 메모 | 진행 원칙·경계 요약, 최근 변경 로그, 오피스 로그 |

주소: https://bibae371-ui.github.io/office/

## 파일

| 파일 | 역할 |
|---|---|
| `index.html` | 화면 골격·CSS·정적 배지 4개(대회의실/지휘실/부서/라운지). 배지 위치는 `left/top` % 값 |
| `app.js` | 탭 UI·회의실 피드·결재함·부서현황·메모 렌더 |
| `pixelmap.js` | 픽셀아트 맵 캔버스·봇 애니메이션 (`기본` 보기) |
| `data.json` | **현황 데이터. 갱신은 이 파일만 고치면 된다.** |
| `clay_office.png` | 클레이 3D 오피스 이미지 (1024×1536). 텍스트 라벨 없이 생성한 원본 |

> `index.html`의 스크립트 쿼리(`app.js?v=12`)는 JS를 고칠 때마다 올린다. GitHub Pages가 URL 단위로 캐시하기 때문에, 올리지 않으면 폰에 옛 JS가 남는다.

## 갱신 방법

1. `office/data.json` 수정 → `git commit` → `git push`
2. GitHub Pages 반영(약 30초) 뒤 새로고침. 페이지는 5분마다 자동으로 다시 읽는다.

## data.json 필드

```
updated      "2026-11-27T11:45:00+09:00"   마지막 갱신 시각
headline     헤더 한 줄 요약
ceo          {name, room, bubble, note}    지휘실 배지·히어로 문구
approvals[]  대표 결재함: {icon, team, title, meta, urgent, options[], note}
completed[]  부서별 처리 완료: {team, icon, items[], links[{label, href}]}
logs[]       오피스 로그: {t, text}
departments[] 부서 7개 (방과 1:1 연결)
   id, name, icon, room, channels[], bubble, status(ok|wait|run), progress,
   updated, tasks[{text, state: done|wait|run}], links[], queue[{t, text}]
channels[]   5대 채널 카드: {name, tag, icon, today(null 가능), todayAt, yesterday, unit, note, status}
revenue[]    수익·광고 카드: {icon, name, value, state, note}
meeting[]    회의실 피드: {room: hall|ceo|lounge|team, team: secretary|economy|health|tistory|dayeon|global|local|finance|webtools, t: "11:42", text}
memo         {principles[], boundaries[], changelog[{t, v, text}]}
```

`meeting[]`·`channels[]`·`revenue[]`·`memo`가 없어도 화면은 뜬다(app.js 안의 기본값 사용). 값이 있으면 data.json이 우선.

## 방 배치 (픽셀 맵, 고정)

```
        [대표실]   복도   [회의실]
[경제·X팀]   ‖   [로컬직판팀]
[건강·공포팀] ‖   [재무·스폰서팀]
[다연돈팀]   ‖   [웹도구팀]
[해외수면팀]  ‖
        [탕비실]
```

## 개인정보 원칙

`data.json`에는 실명·생일·나이·개인 계좌·비밀번호·토큰을 넣지 않는다. 수금용 법인 명의와 사업자정보까지만.
