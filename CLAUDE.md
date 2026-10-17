# CLAUDE.md

이 파일은 Claude Code가 이 저장소에서 작업할 때 참조하는 메인 컨텍스트 파일입니다.

## 1. 프로젝트 개요

**Gather** - 초대 링크 하나로 생일 파티, 워크샵, 세미나 등 5~30명 규모의 일회성 이벤트를 관리하는 모바일 퍼스트 웹 플랫폼입니다.

- **사용자**: 주최자(이벤트 생성/공유), 참여자(링크로 참여), 관리자(데스크톱 대시보드, `role: admin`)
- **핵심 흐름**: 이벤트 생성 → 초대 링크 자동 생성 → 공유 → 참여자 로그인 후 자동 참여 → 실시간 참여자 확인
- **현재 단계**: Phase 1 (MVP) 진행 중. 계획은 [docs/ROADMAP.md](docs/ROADMAP.md), 요구사항은 [docs/PRD.md](docs/PRD.md) 참조

### 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js 15 (App Router), React 19, TypeScript (strict) |
| 스타일링/UI | Tailwind CSS v4, shadcn/ui (new-york, Radix UI), Lucide React, next-themes |
| 폼/검증 | React Hook Form, Zod |
| 백엔드 | Supabase (Auth with Google OAuth, PostgreSQL, Storage, Realtime) |
| 차트 | Recharts |
| 알림 UI | Sonner |
| 품질 도구 | ESLint, Prettier, Husky, lint-staged, Playwright (E2E) |

### 개발 명령어

```bash
npm run dev          # 개발 서버 (Turbopack)
npm run build        # 프로덕션 빌드
npm run check-all    # typecheck + lint + format:check (권장)
npm run lint:fix     # ESLint 자동 수정
npm run format       # Prettier 포맷팅
npm run test:e2e     # Playwright E2E 테스트
npm run db:types     # Supabase 타입 생성 (database.types.ts)
npx shadcn@latest add [component]  # shadcn/ui 컴포넌트 추가
```

### 환경 변수 (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=[Supabase 프로젝트 URL]
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=[Supabase Publishable(Anon) Key]
```

환경 변수가 없으면 미들웨어는 세션 검사를 건너뜁니다.

---

## 2. 폴더 구조

```
.
├── app/
│   ├── (mobile)/              # 주최자/참여자 화면 (모바일 퍼스트)
│   │   ├── page.tsx           # 홈 (내 이벤트)
│   │   ├── events/            # 목록, new, [id], [id]/edit
│   │   ├── invite/[code]/     # 초대 링크 안내
│   │   ├── join/[code]/       # 초대 링크 참여
│   │   └── profile/           # 프로필, edit
│   ├── admin/                 # 관리자 (데스크톱)
│   │   ├── login/
│   │   └── (dashboard)/       # dashboard, events, users, stats
│   ├── auth/                  # login, sign-up, callback, confirm, setup-profile 등
│   ├── actions/               # Server Actions (admin, auth, events, profile, upload)
│   └── protected/             # 스타터 킷 보호 페이지
├── components/
│   ├── ui/                    # shadcn/ui 컴포넌트
│   ├── admin/                 # 관리자 컴포넌트 (stat-card, charts/)
│   ├── events/                # 이벤트 폼, 카드, 공유/삭제 다이얼로그 등
│   ├── participants/          # 참여자 카드
│   ├── navigation/            # mobile-nav, admin-sidebar
│   ├── skeletons/             # 로딩 스켈레톤
│   └── tutorial/              # 스타터 킷 튜토리얼 (정리 대상)
├── lib/
│   ├── supabase/              # client.ts, server.ts, middleware.ts, database.types.ts
│   ├── data/                  # 서버 측 데이터 조회 함수 (admin, events, participants, users)
│   ├── queries/               # 쿼리 헬퍼 (admin, events, profile)
│   ├── schemas/               # Zod 스키마 (event, profile)
│   ├── types/                 # 도메인/API/폼/컴포넌트 타입
│   ├── utils/                 # date, format, invite-code, toast, username 등
│   └── auth/oauth.ts          # OAuth 헬퍼
├── docs/                      # PRD.md, ROADMAP.md, 가이드, tasks/
├── middleware.ts              # 인증 미들웨어 진입점
├── playwright.config.ts       # E2E 설정
└── .claude/                   # agents, commands, hooks
```

경로 별칭: `@/*` → 프로젝트 루트 (예: `import { Button } from "@/components/ui/button"`)

---

## 3. 주요 규칙 및 컨벤션

### 언어 및 커뮤니케이션

- 응답, 코드 주석, 커밋 메시지, 문서는 **한국어**로 작성
- 변수명/함수명은 **영어**

### 코드 스타일

- 들여쓰기 스페이스 2칸
- 변수명 camelCase, 함수명은 동사로 시작 (`getUserData`, `handleClick`)
- 컴포넌트 파일명은 kebab-case, 컴포넌트명은 PascalCase
- TypeScript strict 모드 준수, `any` 사용 지양

### Supabase 클라이언트 사용

| 환경 | 파일 | 비고 |
|------|------|------|
| Server Components / Route Handlers / Server Actions | `lib/supabase/server.ts`의 `createClient()` | 호출마다 새로 생성 (전역 변수 금지) |
| Client Components | `lib/supabase/client.ts`의 `createClient()` | `createBrowserClient` 사용 |
| Middleware | `lib/supabase/middleware.ts`의 `updateSession()` | |

**주의**
- `createServerClient`와 `supabase.auth.getClaims()` 사이에 코드를 추가하지 않습니다.
- 미들웨어에서 새 Response 객체를 만들면 쿠키를 반드시 복사합니다.
- 데이터 변경은 `app/actions/*`의 Server Actions, 조회는 `lib/data/*`에서 처리합니다.

### 인증 및 권한

- 미들웨어가 요청을 가로채 인증 상태를 확인하고, 미인증 사용자는 `/auth/login`으로 리다이렉트합니다.
- `/auth/*`는 공개 경로입니다.
- 관리자 영역(`/admin/*`)은 `role: admin` 사용자만 접근할 수 있으며, 권한 검증은 서버에서 수행합니다.
- 이벤트 수정/삭제는 주최자(`created_by`)만 가능합니다. UI 숨김에 의존하지 말고 서버와 RLS에서 확인합니다.

### 컴포넌트 및 UI

- 기본은 Server Component, 상호작용이 필요한 경우에만 `'use client'`를 사용합니다.
- UI는 `components/ui/`의 shadcn/ui를 우선 사용하고, 새 컴포넌트는 `npx shadcn@latest add`로 추가합니다.
- 모바일 화면은 터치 영역 48px 이상을 지키고, 다크 모드와 반응형을 함께 고려합니다.
- 폼은 React Hook Form + Zod(`lib/schemas`)를 사용합니다.
- 사용자 알림은 `lib/utils/toast.ts`(Sonner)를 사용합니다.

### Git 규칙

- 브랜치명: `feature/기능명`
- 커밋 메시지: 한국어, 이모지 + 컨벤셔널 형식 (예: `✨ feat: 구글 소셜 로그인 추가`)
- **커밋 전에 반드시 린트 실행** (`npm run lint`). Husky pre-commit이 스테이지된 파일에 ESLint + Prettier를 자동 실행합니다.

### 작업 완료 체크리스트

```bash
npm run check-all   # 타입체크 + 린트 + 포맷 검사 통과
npm run build       # 빌드 성공
```

API/비즈니스 로직 변경은 Playwright E2E로 검증하고, 완료한 작업은 [docs/ROADMAP.md](docs/ROADMAP.md)에 체크합니다.

### 보안

- 계정 정보, API 키 등 비밀 값은 이 파일을 포함해 저장소 문서에 기록하지 않습니다 (`.env.local` 사용).
- 테스트 계정은 팀 내 별도 채널로 공유합니다.

---

## 4. 상세 규칙 (자동 import)

아래 문서는 `@` import로 항상 컨텍스트에 포함됩니다.

@docs/next-js.md
@docs/supabase.md
@docs/coding-style.md

## 5. 참고 문서

- [docs/PRD.md](docs/PRD.md): 제품 요구사항 (기능 목록, 기술 스택, 사용자 스토리)
- [docs/ROADMAP.md](docs/ROADMAP.md): 개발 로드맵 및 체크리스트
- [docs/AUTH_TESTING_GUIDE.md](docs/AUTH_TESTING_GUIDE.md): 인증 테스트 가이드

## 6. MCP 서버

`.mcp.json`에 설정: supabase(DB 연동), playwright(브라우저 자동화/E2E), context7(라이브러리 문서), shadcn(컴포넌트 관리), shrimp-task-manager(작업 관리)
