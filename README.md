# 희망당 공식 랜딩 사이트

당근 비즈프로필 **희망당(ID 4212973)** 의 '홈페이지' 링크와 유튜브·블로그·스레드 전환 페이지로 쓰는 모바일 최적화 원페이지 사이트입니다. 서버 없이 정적 파일만으로 동작합니다.

## 파일 구성

```
huimangdang_site/
├── index.html                사이트 본체 (HTML + CSS + JS 전부 포함, 외부 라이브러리 없음)
├── README.md                 이 문서
└── assets/
    ├── logo.png              희망당 로고 (히어로·헤더·푸터)
    ├── sample_1p.webp        리포트 미리보기 1페이지
    ├── sample_2p.webp        리포트 미리보기 2페이지
    ├── promo_990.webp        990원 오픈 특가 이미지 (마지막 CTA)
    ├── review_kakao_1.webp   실제 카카오톡 후기 캡처 1 (후기 섹션 갤러리)
    ├── review_kakao_2.webp   실제 카카오톡 후기 캡처 2
    ├── review_kakao_3.webp   실제 카카오톡 후기 캡처 3
    ├── reviews_banner.webp   후기 배너 (현재 페이지에는 미사용, 당근 게시물용으로 보관)
    ├── favicon.png           파비콘
    ├── apple-touch-icon.png  아이폰 홈화면 아이콘
    ├── og_image.jpg          카카오톡·SNS 공유 썸네일
    ├── pretendard-subset.woff2  본문 폰트 (사용 글자만 추린 서브셋)
    └── serif-subset.woff2       제목 폰트 (사용 글자만 추린 서브셋)
```

전체 용량 약 1.2MB.

## 로컬에서 확인

```bash
cd huimangdang_site
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```

`index.html` 을 더블클릭해 `file://` 로 열면 브라우저 보안 정책 때문에 웹폰트가 막혀 시스템 폰트로 보입니다. 배포(http/https)에서는 정상 적용되므로 로컬 확인만 위 서버 명령을 쓰면 됩니다.

## 배포 (도메인 연결)

- **Cloudflare Pages**: dash.cloudflare.com → Workers & Pages → Create → Pages → Upload assets 에 이 폴더를 통째로 업로드. `xxx.pages.dev` 주소가 바로 생기고, 무료 플랜에서 커스텀 도메인 연결 가능.
- **GitHub Pages**: 새 저장소에 이 폴더를 push → Settings → Pages → Branch `main` / root 선택 → `아이디.github.io/저장소명` 발급.
- **기타 정적 호스팅**: Netlify(드래그 앤 드롭), Vercel, 카페24·가비아 웹호스팅의 `html` 폴더 업로드도 같은 방식으로 동작합니다.
- 배포 후 **당근 비즈프로필 편집 → 홈페이지 칸**에 발급된 주소를 넣으면 프로필에서 바로 열립니다.

## 수정할 때

- **가격·상품 문구**: `index.html` 안의 `STEP 01`~`STEP 04` 카드 부분
- **카톡 후기 캡처**: `assets/review_kakao_1~3.webp` 파일만 같은 이름으로 갈아끼우면 갤러리에 바로 반영됩니다(권장 720px 폭). 후기 캡처 설명과 대체텍스트는 신뢰 섹션 `.kakao-block` 안에 있습니다.
- **신청서 → 당근 링크**: 스크립트 상단의 `var PROFILE = "..."` 한 곳만 바꾸면 폼의 '채팅 열기' 버튼과 푸터 링크에 반영됩니다. (HTML의 `<a>` 태그 주소 3곳도 같이 바꾸면 완전 일치)
- **폰트**: 사용 글자만 추린 서브셋이라, 문구를 크게 바꿔 새 글자가 생기면 그 글자만 시스템 폰트로 표시됩니다. 폰트를 통째로 쓰려면 `assets/pretendard-subset.woff2` 를 Pretendard 원본(약 2MB)으로 교체하세요.

## 동작 방식 (서버 없음)

- 신청서 입력값은 브라우저 안에서만 문구를 만드는 데 쓰이고 **어디로도 전송·저장되지 않습니다.**
- [신청 문구 복사 후 당근 채팅 열기] → 문구를 클립보드에 복사하고 당근 비즈프로필을 새 창으로 엽니다. 복사가 막히는 환경에서는 화면에 문구가 그대로 남아 직접 복사할 수 있습니다.
- 결제는 사이트에서 하지 않습니다. 당근 채팅에서 안내합니다.
