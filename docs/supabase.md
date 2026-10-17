# Supabase 사용 가이드

이 프로젝트에서 Supabase(Auth, PostgreSQL, Storage, Realtime)를 사용하는 방법과 규칙입니다.
Next.js 규칙은 [next-js.md](./next-js.md), 프로젝트 전반은 [CLAUDE.md](../CLAUDE.md)를 참조하세요.

---

## 1. 환경 설정

### 환경 변수 (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=[Supabase 프로젝트 URL]
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=[Publishable(Anon) Key]
```

- 두 값은 브라우저에 노출되어도 되는 공개 키입니다. 데이터 보호는 **RLS**가 담당합니다.
- `service_role` 키는 RLS를 우회하므로 **클라이언트·저장소·문서에 절대 넣지 않습니다.** 현재 코드에서는 사용하지 않습니다. 꼭 필요하면 서버 전용 환경 변수(`NEXT_PUBLIC_` 접두사 없음)로만 사용합니다.
- 환경 변수가 없으면 미들웨어는 세션 검사를 건너뜁니다 (`hasEnvVars` 확인).

### 패키지

- `@supabase/ssr`: Next.js SSR용 쿠키 기반 세션 처리
- `@supabase/supabase-js`: Supabase 클라이언트

### Google OAuth 설정 체크리스트

- [ ] Google Cloud Console에서 OAuth 클라이언트 생성
- [ ] Supabase Dashboard → Authentication → Providers → Google 활성화 (Client ID/Secret 입력)
- [ ] Supabase Authentication → URL Configuration의 **Site URL**과 **Redirect URLs**에 아래를 등록
  - 로컬: `http://localhost:3000/auth/callback`
  - 배포: `https://[배포 도메인]/auth/callback`

---

## 2. 클라이언트 3종

환경에 맞는 클라이언트를 사용합니다.

| 환경 | 파일 | 함수 |
|------|------|------|
| Server Component / Server Action / Route Handler | `lib/supabase/server.ts` | `await createClient()` |
| Client Component | `lib/supabase/client.ts` | `createClient()` |
| Middleware | `lib/supabase/middleware.ts` | `updateSession(request)` |

### 서버

```typescript
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  // 함수 안에서 매번 새로 생성 (전역 변수 금지 - Fluid compute)
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").select("id, title");
}
```

### 클라이언트

```typescript
"use client";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();
```

### 반드시 지킬 것

- 서버 클라이언트를 **모듈 최상단 전역 변수**에 저장하지 않습니다.
- 미들웨어에서 `createServerClient`와 `supabase.auth.getClaims()` 사이에 코드를 넣지 않습니다. 세션이 무작위로 끊길 수 있습니다.
- 미들웨어에서 새 `NextResponse`를 만들면 기존 응답의 쿠키를 복사합니다.
- Client Component에서는 서버 클라이언트를 import하지 않습니다.

---

## 3. 인증 (Auth)

### 로그인 흐름 (Google OAuth)

```
1. signInWithGoogle(next)            lib/auth/oauth.ts (Client)
2. Google 인증
3. /auth/callback?code=...&next=...  app/auth/callback/route.ts
   └ exchangeCodeForSession(code)
   └ profiles.username 없음 → /auth/setup-profile?next=...
   └ username 있음 → next 경로로 이동
4. 이벤트 참여 링크에서 시작했다면 next=/join/[code] 로 복귀
```

### 사용자 확인 방법

| 메서드 | 용도 |
|--------|------|
| `supabase.auth.getUser()` | **서버 측 인증/권한 판단에 사용**. Auth 서버에 검증 요청 |
| `supabase.auth.getClaims()` | 미들웨어의 빠른 세션 확인 |
| `supabase.auth.getSession()` | 서버 코드의 신원 판단에 사용하지 않습니다 (쿠키 값을 신뢰할 수 없음) |

```typescript
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return { success: false, message: "로그인이 필요합니다." };
```

### 관리자 권한

- 관리자는 `profiles.role = 'admin'`인 사용자입니다.
- 관리자 Server Action은 항상 `lib/utils/admin.ts`의 `verifyAdminAccess()`를 먼저 호출합니다.

```typescript
const authCheck = await verifyAdminAccess();
if (!authCheck.authorized) return { success: false, message: authCheck.message };
```

- `role`은 사용자가 수정할 수 없어야 합니다. `profiles` UPDATE 정책에서 `role` 변경을 막거나, 관리자 전용 경로로만 변경하도록 합니다.

### 주의: 로그인 후 이동 경로 (open redirect)

`/auth/callback`과 `/auth/confirm`은 `next` 파라미터를 받아 리다이렉트합니다. 외부 URL로 이동하지 않도록 `/`로 시작하고 `//`로 시작하지 않는 내부 경로인지 검증해야 합니다.

```typescript
const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
```

현재 callback 코드는 이 검증이 없으므로 보강이 필요합니다.

---

## 4. 데이터베이스

### 테이블 (`public` 스키마)

> 사용자 테이블 이름은 **`profiles`** 입니다 (PRD 문서의 `users`에 해당).

**profiles**

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | `auth.users.id`와 동일 |
| username | text \| null | 닉네임 (없으면 `/auth/setup-profile`로 유도) |
| full_name | text \| null | 이름 |
| email | text \| null | 이메일 |
| avatar_url | text \| null | 프로필 사진 |
| website | text \| null | |
| role | text (기본값 있음) | `user` / `admin` |
| created_at, updated_at | timestamp | |

**events**

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | |
| title | text | 제목 (최대 50자, 앱에서 검증) |
| description | text \| null | 설명 (최대 500자) |
| event_date | timestamp | 일시 |
| location | text | 장소 (최대 100자) |
| cover_image_url | text \| null | 커버 이미지 공개 URL |
| invite_code | text | 초대 코드 (고유) |
| status | text (기본값 있음) | 이벤트 상태 |
| created_by | uuid (FK → profiles.id) | 주최자 |
| created_at, updated_at | timestamp | |

**event_participants**

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | |
| event_id | uuid (FK → events.id) | |
| user_id | uuid (FK → profiles.id) | |
| role | text | 주최자 / 참여자 구분 |
| joined_at | timestamp | |

관계: `profiles 1 ── N events (created_by)`, `events 1 ── N event_participants`, `profiles 1 ── N event_participants`

### 권장 제약과 인덱스

- `events.invite_code` UNIQUE + 인덱스
- `event_participants (event_id, user_id)` UNIQUE (중복 참여 방지)
- 인덱스: `events.created_by`, `event_participants.event_id`, `event_participants.user_id`

### 타입 생성

스키마를 변경한 뒤에는 반드시 타입을 다시 생성합니다.

```bash
npm run db:types          # SUPABASE_PROJECT_ID 환경 변수 필요
npm run db:types:local    # 로컬 Supabase 사용 시
```

결과는 `lib/supabase/database.types.ts`에 저장됩니다. 직접 수정하지 않습니다. 도메인 타입은 이 파일의 `Tables<"events">` 등을 기반으로 `lib/types/models.ts`에서 확장합니다.

### 쿼리 작성 규칙

- 조회는 `lib/data/*`, `lib/queries/*`에 함수로 분리합니다.
- `select("*")` 대신 **필요한 컬럼만** 선택합니다.
- 관계 조회는 한 번의 쿼리로 가져옵니다.

```typescript
const { data, error } = await supabase
  .from("event_participants")
  .select("id, role, joined_at, profiles(id, username, avatar_url)")
  .eq("event_id", eventId)
  .order("joined_at", { ascending: true });
```

- 단건 조회는 `.single()`(없으면 에러) 또는 `.maybeSingle()`(없을 수 있을 때)을 용도에 맞게 사용합니다.
- **`error`는 항상 확인합니다.** 에러를 무시하고 `data`만 쓰지 않습니다.
- 목록은 `.range()`로 페이지네이션하고, 정렬은 `.order()`를 명시합니다.
- 사용자 입력을 문자열로 이어 붙여 필터를 만들지 않습니다 (`.eq()`, `.ilike()` 등 파라미터 메서드 사용).

---

## 5. Row Level Security (RLS)

모든 `public` 테이블은 **RLS를 활성화**합니다. 앱 코드의 권한 검사는 UX용이고, 실제 보안은 RLS가 보장해야 합니다.

### 권장 정책

| 테이블 | 작업 | 허용 대상 |
|--------|------|----------|
| profiles | SELECT | 인증된 사용자 (참여자 목록 표시용) |
| profiles | UPDATE | 본인 (`id = auth.uid()`), `role` 컬럼은 변경 불가 |
| events | SELECT | 인증된 사용자 (초대 코드로 미리보기 필요 시 별도 경로 고려) |
| events | INSERT | 인증된 사용자 (`created_by = auth.uid()`) |
| events | UPDATE / DELETE | 주최자 (`created_by = auth.uid()`) 또는 관리자 |
| event_participants | SELECT | 해당 이벤트 참여자 또는 주최자 |
| event_participants | INSERT | 본인 (`user_id = auth.uid()`) |
| event_participants | DELETE | 본인 또는 이벤트 주최자 |

```sql
-- 예시: 주최자만 이벤트 수정
create policy "주최자만 이벤트 수정"
on public.events for update
to authenticated
using (created_by = (select auth.uid()))
with check (created_by = (select auth.uid()));
```

### 규칙

- 정책에서 `auth.uid()`는 `(select auth.uid())` 형태로 감싸 성능을 확보합니다.
- 관리자 판정은 정책에서 `profiles.role` 조회가 순환 참조되지 않도록 `security definer` 함수(`is_admin()`)로 분리합니다.
- 정책 변경 후에는 **일반 사용자 / 주최자 / 다른 사용자 / 관리자** 4가지 계정으로 접근 가능 여부를 테스트합니다.
- 스키마 변경 SQL은 `supabase/migrations`에 파일로 남깁니다 (현재 저장소에는 마이그레이션 파일이 없으므로 정리가 필요합니다).

---

## 6. Storage

| 항목 | 값 |
|------|----|
| 버킷 | `event-covers` (공개 읽기) |
| 업로드 | `app/actions/upload.ts`의 `uploadCoverImageAction` (Server Action) |
| 제한 | 인증 필수, 최대 5MB, JPEG / PNG / WebP |
| 파일명 | 타임스탬프 + 원본 파일명 |

```typescript
const { error } = await supabase.storage.from("event-covers").upload(path, file);
const { data } = supabase.storage.from("event-covers").getPublicUrl(path);
```

- 업로드는 서버에서 인증과 파일 검증(크기, MIME)을 한 뒤 수행합니다.
- Storage 정책: 읽기는 공개, 업로드는 인증된 사용자, 삭제는 업로드한 본인으로 제한합니다.
- 파일명은 사용자 입력을 그대로 쓰지 말고 안전한 문자만 남깁니다.
- 공개 URL의 도메인은 `next.config.ts`의 `images.remotePatterns`에 등록되어 있어야 `next/image`로 표시됩니다.
- 이벤트 삭제나 커버 교체 시 이전 파일이 남지 않도록 정리합니다.

---

## 7. Realtime (참여자 목록 실시간 갱신)

> 현재 코드에는 아직 구독 구현이 없습니다 (로드맵 Phase 1-5 미완료 항목). 구현 시 아래 패턴을 따릅니다.

1. 대상 테이블(`event_participants`)에 Realtime을 활성화합니다 (Dashboard → Database → Replication, 또는 publication 추가).
2. Client Component에서 구독하고, **언마운트 시 반드시 해제**합니다.

```typescript
"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function useParticipantsRealtime(eventId: string, onChange: () => void) {
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`event-participants-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_participants", filter: `event_id=eq.${eventId}` },
        onChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, onChange]);
}
```

- 초기 데이터는 Server Component에서 가져오고, Realtime은 변경분 반영에만 사용합니다.
- Realtime 이벤트도 RLS가 적용됩니다. SELECT 정책이 맞지 않으면 이벤트가 오지 않습니다.
- 구독 후 프로필 정보가 필요하면 변경 이벤트 수신 시 목록을 다시 조회(`router.refresh()` 또는 재요청)합니다.

---

## 8. 에러 처리와 보안 체크리스트

### 에러 처리

- Supabase 응답의 `error`는 항상 확인하고, 사용자에게는 한국어로 친절한 메시지를, 서버 로그에는 원본 에러를 남깁니다.
- 인증 에러 메시지 변환은 `lib/utils/auth-errors.ts`를 사용합니다.
- 예상 가능한 실패(중복 참여, 권한 없음)는 throw하지 말고 `ActionResult`로 반환합니다.

### 보안 체크리스트

- [ ] 모든 `public` 테이블에 RLS가 켜져 있는가
- [ ] 서버 측 신원 판단에 `getUser()`를 사용했는가 (`getSession()` 금지)
- [ ] `service_role` 키가 코드, 저장소, 문서에 없는가
- [ ] `profiles.role`을 일반 사용자가 변경할 수 없는가
- [ ] 관리자 액션이 `verifyAdminAccess()`로 시작하는가
- [ ] 로그인 후 `next` 리다이렉트가 내부 경로로 제한되는가
- [ ] 업로드 파일의 크기와 MIME 타입을 서버에서 검증하는가
- [ ] 스키마를 바꾼 뒤 `npm run db:types`로 타입을 갱신했는가

---

## 9. Supabase MCP

`.mcp.json`에 Supabase MCP 서버가 등록되어 있어 테이블 조회, SQL 실행, 마이그레이션 적용, 타입 생성을 Claude Code에서 할 수 있습니다.

- 최초 사용 시 인증이 필요합니다.
- 운영 데이터에 대한 `DELETE`, `UPDATE`, DDL은 실행 전 반드시 대상과 영향 범위를 확인합니다.
- 스키마 변경은 즉석 SQL 대신 **마이그레이션**으로 적용해 이력을 남깁니다.
