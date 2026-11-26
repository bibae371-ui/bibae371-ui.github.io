# AI 오피스 현황판 (`/office/`)

픽셀아트 AI 오피스 평면에서 봇들이 일하는 화면 + 대표 결재함 / 부서별 처리 완료 패널.
주소: https://bibae371-ui.github.io/office/

## 파일

| 파일 | 역할 |
|---|---|
| `index.html` | 화면 골격·CSS (여기는 거의 안 건드린다) |
| `app.js` | 픽셀 렌더러·봇 애니메이션·패널 렌더 |
| `data.json` | **현황 데이터. 갱신은 이 파일만 고치면 된다.** |

## 갱신 방법

1. `office/data.json` 수정 → `git commit` → `git push`
2. GitHub Pages 반영(약 30초) 뒤 새로고침. 페이지는 5분마다 자동으로 다시 읽는다.
   (즉시 확인하려면 새로고침 한 번)

## data.json 필드

```
updated      "2026-11-26T12:52:00+09:00"  마지막 갱신 시각 (헤더에 표시)
headline     "5대 포트폴리오 + 지원 2부서 · 7팀 가동 중"
approvals[]  대표 결재함: {icon, team, title, meta, urgent, options[], note}
completed[]  부서별 처리 완료: {team, icon, items[], links[{label, href}]}
logs[]       오피스 로그: {t, text}
departments[] 부서 7개 (방과 1:1 연결)
   id        고유 id (economy/health/dayeon/global/local/finance/webtools)
   name      방 라벨 (예: "경제·X팀")
   icon      이모지
   room      방 키 — 아래 표의 값만 쓸 수 있다
   channels  채널 칩 (계정·매체 이름)
   bubble    방 위 말풍선 문구 (짧게, 8자 안팎)
   status    ok(완료) | wait(결재대기) | run(진행중)  → 말풍선 색이 바뀐다
   progress  0~100 (상세 카드 진행바)
   updated   "12:40" 같은 갱신 시각
   tasks[]   {text, state: done|wait|run}
   links[]   (선택) {label, href}
```

## 방 배치 (고정)

```
        [대표실]   복도   [회의실]        ← 3F 위층
[경제·X팀]   ‖   [로컬직판팀]
[건강·공포팀] ‖   [재무·스폰서팀]          ← 가운데 부서층
[다연돈팀]   ‖   [웹도구팀]
[해외수면팀]  ‖
        [탕비실]                        ← 아래층
```

팀을 새로 추가하려면 `app.js`의 `ROOMS`에 방을 하나 더 넣고(좌 4칸·우 3칸 구조라 자리가 필요),
`departments`에 같은 `room` 키로 항목을 넣으면 된다.

## 동작

- 봇 13명: 부서 봇 7 + 회의실 팀장 3 + 탕비실 2 + 대표 1
- 부서 봇은 책상에서 타이핑하다가 결재 서류를 들고 대표실로 올라가고, 회의실·탕비실에 갔다 온다.
- 방을 누르면 아래 `부서 상세` 카드가 그 부서로 바뀌고 방이 하이라이트된다. 다시 누르면 전체 보기.
