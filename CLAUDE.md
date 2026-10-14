# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 명령어

```bash
npm run dev     # 개발 서버 (localhost:3000)
npm run build   # 프로덕션 빌드
npm run start   # 프로덕션 서버 실행
npm run lint    # ESLint (eslint .) — 커밋 전 반드시 실행 (전역 git 규칙)
```

테스트 러너는 설정되어 있지 않다.

환경 변수 (`.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (legacy anon 키도 같은 변수에 사용 가능).

## 아키텍처

Next.js (App Router, React 19) + Supabase Auth (`@supabase/ssr`, 쿠키 기반 세션) + Tailwind CSS v3 + shadcn/ui 스타터 기반 프로젝트. 소스는 `src/` 없이 루트의 `app/`, `components/`, `lib/`에 있다. 경로 별칭은 `@/*`.

### 인증 흐름 (여러 파일에 걸침)

- `proxy.ts` (루트): Next.js의 `middleware` 대신 `proxy` 규약을 사용한다. `lib/supabase/proxy.ts`의 `updateSession`을 호출하며, 정적 파일/이미지를 제외한 모든 경로에 적용된다.
- `lib/supabase/proxy.ts`: 요청마다 새 Supabase 클라이언트를 만들어 쿠키를 갱신하고 `supabase.auth.getClaims()`로 사용자를 확인한다. 비로그인 사용자는 `/`, `/login*`, `/auth*`를 제외하고 `/auth/login`으로 리다이렉트된다. `createServerClient`와 `getClaims()` 사이에 코드를 넣지 말 것, 그리고 반환하는 `supabaseResponse`를 그대로 반환해야 세션이 끊기지 않는다.
- `lib/supabase/server.ts` (서버 컴포넌트/라우트 핸들러)와 `lib/supabase/client.ts` (브라우저)로 클라이언트가 분리되어 있다. 서버 클라이언트는 전역 변수에 두지 말고 함수 호출마다 `await createClient()`로 생성한다.
- `app/auth/*`: 로그인/회원가입/비밀번호 재설정 페이지, `app/auth/confirm/route.ts`는 이메일 OTP 확인 처리.
- `app/protected/`: 로그인 필수 영역 (자체 `layout.tsx`에 nav/footer 포함).

### UI

- `components/ui/`: shadcn/ui 프리미티브 (`components.json` 설정). 새 컴포넌트는 shadcn CLI로 추가한다.
- `lib/utils.ts`: `cn()` 헬퍼와 `hasEnvVars` (env 미설정 시 proxy 검사를 건너뛰고 경고 UI 표시 — 튜토리얼용이라 제거 가능).
- `components/tutorial/`, `deploy-button`, `hero` 등은 스타터 데모 코드로 실제 기능 개발 시 교체/삭제 대상.

## 참고 문서

`docs/guide/`에 한국어 가이드가 있다 (component-patterns, forms-react-hook-form, nextjs-15, project-structure, styling-guide). 단, `project-structure.md`는 `src/` 구조를 가정하고 있어 현재 레이아웃(루트 `app/`)과 다르다. 또한 `react-hook-form` 가이드가 있으나 해당 의존성은 아직 설치되어 있지 않다.

## 규칙 (전역 설정에서)

- 응답, 코드 주석, 커밋 메시지, 문서는 한국어. 변수/함수명은 영어.
- 들여쓰기 스페이스 2칸, 변수 camelCase, 함수명은 동사로 시작.
- 브랜치명 `feature/기능명`.
