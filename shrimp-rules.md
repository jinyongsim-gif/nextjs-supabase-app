# Gather 개발 규칙 (AI Agent 전용)

## 1. 프로젝트 개요

- 프로젝트: Gather (소규모 이벤트 관리, 초대 코드 기반 참여). 모바일 퍼스트.
- 스택: Next.js 15 App Router, React 19, Supabase (`@supabase/ssr`), Tailwind CSS 4, shadcn/ui (new-york), react-hook-form + zod 4, sonner, recharts.
- 요구사항 원본: `docs/PRD.md`, 로드맵: `docs/ROADMAP.md`, 작업 명세: `docs/tasks/TASK-XXX.md`, 상세 가이드: `docs/guides/*.md`.
- DB 테이블: `profiles`(role: `admin` | 일반), `events`, `event_participants`.

## 2. 디렉토리 구조 및 배치 규칙

| 경로 | 역할 | 규칙 |
|------|------|------|
| `app/(mobile)/` | 일반 사용자 페이지 (events, invite, join, profile) | 모바일 레이아웃(`layout.tsx`) 하위에만 추가 |
| `app/admin/(dashboard)/` | 관리자 페이지 | 하단 `admin/login`은 인증 예외 |
| `app/auth/` | 인증 페이지/라우트 (login, sign-up, callback, confirm, setup-profile 등) | 인증 흐름 수정 시 3.3 참조 |
| `app/actions/` | Server Actions (`admin`, `auth`, `events`, `profile`, `upload`) | 도메인별 파일에 추가 |
| `lib/queries/` | Supabase 조회 함수 (서버 전용) | 신규 조회는 여기에 추가 |
| `lib/schemas/` | zod 스키마 | 폼 검증은 반드시 여기에 정의 |
| `lib/types/` | 타입 (`models`, `forms`, `admin`, `api`, `components`, `utils`) | `lib/types/index.ts`에서 재export |
| `lib/utils/` | 유틸 (`admin`, `auth-errors`, `date`, `format`, `invite-code`, `toast`, `username`) | 도메인별 파일 사용 |
| `lib/supabase/` | `client.ts`, `server.ts`, `middleware.ts`, `database.types.ts` | 3.1 참조 |
| `lib/data/` | **더미 데이터** (`dummyUsers` 등) | 신규 코드에서 사용 금지 (4 참조) |
| `components/ui/` | shadcn/ui 컴포넌트 | 직접 작성 금지, CLI로 추가 |
| `components/{admin,events,navigation,participants,skeletons}/` | 도메인별 컴포넌트 | 도메인 폴더에 배치 |
| `components/tutorial/`, `hero.tsx`, `deploy-button.tsx`, `next-logo.tsx`, `supabase-logo.tsx` | Supabase 스타터 잔재 | 신규 기능에서 참조 금지 |

## 3. 핵심 규칙

### 3.1 Supabase 클라이언트

- Server Components / Server Actions / Route Handlers: `import { createClient } from "@/lib/supabase/server"`, 함수 내부에서 `await createClient()` 호출.
- Client Components: `import { createClient } from "@/lib/supabase/client"`.
- **금지**: 모듈 최상위(전역) 변수에 클라이언트 저장.
- **금지**: Client Component에서 `server.ts` import.
- `lib/supabase/middleware.ts` 수정 시 `createServerClient`와 `supabase.auth.getClaims()` 사이에 코드 삽입 금지.
- `updateSession`에서 새 `NextResponse`를 만들면 `supabaseResponse`의 쿠키를 반드시 복사.
- 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. `.env*` 파일은 읽거나 커밋 금지.

### 3.2 데이터 조회 / 변경 패턴

- 조회: `lib/queries/*.ts`에 `async` 함수로 작성 → Server Component에서 호출. 내부에서 `createClient()` 사용.
- 변경: `app/actions/*.ts`에 Server Action 작성. 파일 상단 `"use server"`.
- Action 시그니처: `(prevState: ActionResult, formData: FormData): Promise<ActionResult<T>>`. `ActionResult`는 `@/lib/types/forms`.
- Action 내부 순서: 클라이언트 생성 → 인증 확인(`auth.getUser`) → zod 검증 → DB 작업 → `revalidatePath` → `ActionResult` 반환. 예외는 try/catch로 `ActionResult`의 실패 값으로 변환.
- 관리자 Action/쿼리: 반드시 `verifyAdminAccess()` (`lib/utils/admin.ts`) 선행 호출.
- 초대 코드는 `generateUniqueInviteCode()` (`lib/utils/invite-code.ts`) 사용. 직접 생성 금지.
- 사용자 알림은 `lib/utils/toast.ts`의 `showSuccess/showError/showInfo` 사용. `toast` 직접 호출 금지.
- 인증 에러 메시지 변환은 `lib/utils/auth-errors.ts` 사용.

### 3.3 인증 / 라우트 보호

- 보호는 `middleware.ts` → `lib/supabase/middleware.ts#updateSession`에서 처리.
- `/admin/*`: 로그인 + `profiles.role === "admin"` 필수 (`/admin/login` 예외). 미충족 시 `/` 또는 `/admin/login`으로 리다이렉트.
- 공개 경로: `/`, `/login*`, `/auth*`. 그 외 비로그인 접근은 `/auth/login?redirect=<경로>`로 리다이렉트.
- 신규 공개 경로 추가 시 `lib/supabase/middleware.ts`의 조건문 수정 필수.
- Google OAuth: `lib/auth/oauth.ts#signInWithGoogle` → `app/auth/callback/route.ts`. 소셜 로그인 UI는 `components/social-login-buttons.tsx`.
- 신규 사용자는 프로필 설정(`app/auth/setup-profile`, `setupProfileAction`)을 거침. 인증 흐름 변경 시 `callback`, `confirm`, `setup-profile`, `middleware`를 함께 확인.

### 3.4 폼

- react-hook-form + `@hookform/resolvers/zod` + `components/ui/form.tsx` 조합 사용.
- 스키마는 `lib/schemas/*.ts`, 폼 타입은 `lib/types/forms.ts`. 메시지는 한국어.
- 가이드 참조: `docs/guides/forms-react-hook-form.md`.

### 3.5 UI / 스타일

- shadcn 컴포넌트 추가: `npx shadcn@latest add <name>` (또는 shadcn MCP). `components/ui/*` 수동 신규 작성 금지.
- 클래스 병합은 `cn()` (`@/lib/utils`) 사용.
- 아이콘은 `lucide-react`만 사용.
- 색상은 CSS 변수 기반 토큰(`bg-background`, `text-foreground` 등) 사용. 하드코딩 색상으로 다크 모드를 깨지 말 것.
- 로딩 UI는 `components/skeletons/` 재사용/추가. 빈 상태는 `components/ui/empty-state.tsx`.
- Tailwind 설정 파일 없음(v4, `app/globals.css` 사용). `tailwind.config.ts` 생성 금지.
- 가이드 참조: `docs/guides/styling-guide.md`, `docs/guides/component-patterns.md`.

### 3.6 Server / Client 컴포넌트

- 기본은 Server Component. 상태/이벤트/브라우저 API가 필요할 때만 파일 최상단에 `"use client"`.
- Next.js 15: `params`, `searchParams`는 `Promise`이므로 `await` 필요. (`docs/guides/nextjs-15.md`)

## 4. 더미 데이터 → 실제 DB 전환

- `lib/data/*`는 더미 데이터. 현재 `app/(mobile)/events/new/page.tsx`, `app/(mobile)/join/[code]/page.tsx`, `app/admin/(dashboard)/stats/page.tsx`가 참조 중.
- 해당 화면을 수정할 때는 `lib/queries/*` 호출로 교체하는 것을 우선한다.
- 신규 코드에서 `@/lib/data` import 금지.

## 5. 다중 파일 동시 수정 규칙

| 변경 내용 | 함께 수정할 파일 |
|-----------|------------------|
| DB 스키마 변경 | `lib/supabase/database.types.ts` (`npm run db:types`), `lib/types/models.ts`, 관련 `lib/queries/*`, `lib/schemas/*` |
| 폼 필드 추가/변경 | `lib/schemas/*.ts`, `lib/types/forms.ts`, 폼 컴포넌트, 해당 `app/actions/*.ts` |
| 이벤트 필드 변경 | `lib/schemas/event.ts`, `components/events/event-form.tsx`, `event-edit-form.tsx`, `app/actions/events.ts`, `lib/queries/events.ts` |
| 프로필 필드 변경 | `lib/schemas/profile.ts`, `setup-profile-form.tsx`, `profile-edit-form.tsx`, `app/actions/profile.ts`, `lib/queries/profile.ts` |
| 관리자 통계/목록 변경 | `lib/queries/admin.ts`, `app/actions/admin.ts`, `lib/types/admin.ts`, `components/admin/*`, 해당 `app/admin/(dashboard)/*/page.tsx` |
| 새 하단 메뉴/사이드바 항목 | `components/navigation/mobile-nav.tsx` 또는 `admin-sidebar.tsx` |
| 새 보호/공개 경로 | `lib/supabase/middleware.ts` |
| 작업 완료 | `docs/ROADMAP.md` 체크 상태 갱신 (`docs:update-roadmap` 스킬) |
| 주요 규칙/구조 변경 | `CLAUDE.md`, 본 파일 |

## 6. 코드 스타일 (Prettier/ESLint 기준)

- 들여쓰기 스페이스 2칸, 세미콜론 사용, 큰따옴표, `printWidth` 100, `trailingComma: es5`, `arrowParens: always`.
- 변수/함수: camelCase, 함수명은 동사로 시작 (`getUserData`, `handleClick`). 컴포넌트: PascalCase. 파일명: kebab-case.
- 주석/JSDoc/커밋/문서는 **한국어**. 식별자는 영어.
- 모든 export 함수에 한국어 JSDoc(`@param`, `@returns`) 작성 (기존 파일 형식 따름).
- DB 컬럼은 snake_case 그대로 사용 (`event_date`, `invite_code`, `cover_image_url`).
- 경로 import는 `@/` 별칭만 사용.
- TypeScript strict. `any` 금지.

## 7. Git / 검증 워크플로우

- 브랜치: `feature/기능명`. 커밋 메시지: 한국어, 이모지 컨벤셔널 형식 (예: `✨ feat: ...`).
- 커밋 전 반드시 `npm run lint` 실행. 작업 완료 시 `npm run check-all` 후 `npm run build`.
- Husky pre-commit이 lint-staged(ESLint + Prettier)를 실행. `--no-verify` 사용 금지.
- API/비즈니스 로직 작업은 Playwright MCP 또는 `npm run test:e2e`로 검증. 테스트 계정은 `CLAUDE.md` 참조.
- `.claude/scripts/guard-and-format.mjs` 훅이 Edit/Write 시 동작함. 훅이 차단하면 우회하지 말고 원인을 해결.

## 8. AI 의사결정 기준

- 데이터 읽기가 필요한가? → `lib/queries/`에 추가. 데이터 쓰기가 필요한가? → `app/actions/`에 추가.
- 브라우저 상호작용이 필요한가? → 해당 부분만 작은 Client Component로 분리.
- 관리자 기능인가? → `verifyAdminAccess()` + `app/admin/(dashboard)/` 배치.
- UI 프리미티브가 필요한가? → 먼저 `components/ui/` 확인 → 없으면 shadcn CLI로 추가.
- 요구사항이 모호한가? → `docs/PRD.md`, `docs/ROADMAP.md`, `docs/tasks/`를 먼저 확인.

## 9. 금지 사항

- ❌ `const supabase = await createClient();` 를 모듈 최상위에 선언
- ❌ Client Component에서 `@/lib/supabase/server` import
- ❌ `getClaims()` 호출 앞뒤로 middleware에 임의 로직 삽입 (`createServerClient`와 `getClaims` 사이)
- ❌ 관리자 Action에서 `verifyAdminAccess()` 생략
- ❌ 신규 코드에서 `lib/data/*` 더미 데이터 사용
- ❌ `components/ui/*` 직접 신규 작성, `tailwind.config.ts` 재생성
- ❌ `.env*` 읽기/커밋, 테스트 계정 정보를 코드·로그에 하드코딩
- ❌ 린트 미실행 커밋, `git push --force`, `rm -rf`
- ❌ 영어 주석/커밋 메시지

✅ 올바른 예:

```typescript
export async function getEventList() {
  const supabase = await createClient(); // 함수 내부에서 생성
  const { data } = await supabase.from("events").select("*");
  return data ?? [];
}
```
