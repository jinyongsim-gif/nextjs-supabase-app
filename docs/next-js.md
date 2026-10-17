# Next.js 개발 규칙

이 프로젝트(Next.js 15.5, App Router, React 19)에서 Next.js 코드를 작성할 때 지켜야 할 규칙입니다.
프로젝트 전반 규칙은 [CLAUDE.md](../CLAUDE.md), 상세 가이드는 [guides/nextjs-15.md](./guides/nextjs-15.md)를 참조하세요.

---

## 1. 라우팅과 파일 구조

### 라우트 그룹

| 경로 | 용도 |
|------|------|
| `app/(mobile)/*` | 주최자/참여자 화면 (모바일 퍼스트, 하단 내비게이션) |
| `app/admin/*` | 관리자 화면 (데스크톱, 사이드바) |
| `app/auth/*` | 인증 화면과 Route Handler (공개 경로) |
| `app/actions/*` | Server Actions (도메인별 파일) |

- 괄호 그룹 `(mobile)`, `(dashboard)`은 URL에 나타나지 않고 레이아웃을 분리하는 용도로만 사용합니다.
- 페이지는 `page.tsx`, 레이아웃은 `layout.tsx`, 로딩은 `loading.tsx`, 에러는 `error.tsx`, 404는 `not-found.tsx` 규약 이름을 지킵니다.
- 라우트별로만 쓰는 컴포넌트도 `app/` 안에 두지 않고 `components/<도메인>/`에 둡니다.

### 경로 별칭

`@/*`는 프로젝트 루트입니다. 상대 경로(`../../`) 대신 별칭을 사용합니다.

```typescript
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
```

---

## 2. Server Component와 Client Component

- **기본은 Server Component**입니다. 데이터 조회, 인증 확인, 권한 분기는 서버에서 처리합니다.
- `'use client'`는 아래 경우에만 추가합니다.
  - `useState`, `useEffect`, `useActionState` 등 훅 사용
  - 이벤트 핸들러(`onClick`, `onChange`), 브라우저 API 사용
  - Supabase Realtime 구독, `next-themes` 등 클라이언트 전용 라이브러리
- `'use client'`는 가능한 한 **트리의 말단(작은 컴포넌트)** 에 둡니다. 페이지 전체를 Client Component로 만들지 않습니다.
- Server Component를 Client Component의 `children` props로 넘기는 합성 패턴을 사용합니다.
- Client Component에서 서버 전용 모듈(`lib/supabase/server.ts`, `lib/data/*`)을 import하지 않습니다.
- 비밀 값은 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다. 접두사가 붙은 값은 브라우저에 노출됩니다.

---

## 3. Next.js 15 필수 사항

### 동적 API는 비동기

`params`, `searchParams`, `cookies()`, `headers()`는 Promise입니다. 반드시 `await` 합니다.

```typescript
export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // ...
}
```

```typescript
export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
}
```

### Server Component 대신 Client에서 params가 필요할 때

Client Component에서는 `use(params)` 또는 `useParams()`를 사용합니다.

### 캐싱

- `fetch`와 GET Route Handler는 기본적으로 캐시되지 않습니다. 캐시가 필요하면 `next: { revalidate }` 또는 `export const revalidate`를 명시합니다.
- 사용자별 데이터(내 이벤트 등)는 캐시하지 않습니다. 쿠키를 읽는 Supabase 서버 클라이언트는 자동으로 동적 렌더링됩니다.

---

## 4. 데이터 조회 (Server Component)

- 조회 로직은 `lib/data/*`, `lib/queries/*`에 함수로 분리하고 페이지에서는 호출만 합니다.
- 독립적인 조회는 `Promise.all`로 병렬 실행합니다.

```typescript
const [event, participants] = await Promise.all([
  getEventDetail(id),
  getParticipants(id),
]);
```

- 조회 결과가 없으면 `notFound()`, 권한이 없으면 `redirect()`를 호출합니다.
- 인증 확인은 페이지/액션 진입부에서 수행하며, UI에서 버튼을 숨기는 것만으로 권한을 대신하지 않습니다.

---

## 5. Server Actions

### 위치와 선언

- `app/actions/<도메인>.ts` 파일 최상단에 `"use server"`를 선언합니다 (파일 주석 다음, import 이전).
- 파일 하나에는 같은 도메인의 액션만 둡니다 (`events.ts`, `profile.ts`, `auth.ts`, `admin.ts`, `upload.ts`).

### 작성 규칙

1. **입력 검증**: `FormData`를 받으면 `lib/schemas/*`의 Zod 스키마로 `safeParse`합니다.
2. **인증/권한 확인**: 액션 내부에서 `supabase.auth.getUser()` 등으로 사용자를 확인하고, 주최자/관리자 권한은 서버에서 검사합니다.
3. **반환 타입**: `ActionResult<T>` (`lib/types/forms.ts`)로 성공/실패를 반환합니다. 예상 가능한 실패는 throw하지 않습니다.
4. **캐시 갱신**: 데이터 변경 후 `revalidatePath()`로 영향받는 경로를 갱신합니다.
5. **리다이렉트**: `redirect()`는 `try/catch` 밖에서 호출합니다 (내부적으로 예외를 던집니다).
6. 시그니처는 `useActionState`와 호환되도록 `(prevState, formData)` 형태를 유지합니다.

```typescript
"use server";

export async function createEvent(prevState: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = eventFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { success: false, message: "입력값을 확인해주세요." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "로그인이 필요합니다." };

  // ... 저장 후
  revalidatePath("/events");
  return { success: true, message: "이벤트가 생성되었습니다.", data: { id } };
}
```

---

## 6. Route Handler와 Middleware

### Route Handler (`route.ts`)

- OAuth 콜백(`/auth/callback`), 이메일 확인(`/auth/confirm`)처럼 **외부에서 호출되는 엔드포인트**에만 사용합니다. 내부 데이터 변경은 Server Action을 사용합니다.
- 리다이렉트 대상 `next` 파라미터는 반드시 같은 사이트 내부 경로인지 검증합니다 (open redirect 방지).

### Middleware (`middleware.ts`)

- 진입점은 `lib/supabase/middleware.ts`의 `updateSession()` 호출뿐입니다. 로직을 `middleware.ts`에 직접 추가하지 않습니다.
- `createServerClient`와 `supabase.auth.getClaims()` 사이에 코드를 넣지 않습니다.
- 새 `NextResponse`를 만들면 기존 응답의 쿠키를 반드시 복사합니다.
- `matcher`는 정적 파일과 이미지를 제외합니다. 새 정적 확장자를 추가하면 matcher도 함께 수정합니다.
- 미들웨어는 세션 갱신과 1차 인증 리다이렉트만 담당하고, 세부 권한(관리자, 주최자)은 서버 코드에서 다시 확인합니다.

---

## 7. 이미지, 링크, 폰트

- 이미지는 `next/image`를 사용합니다. 외부 이미지는 `next.config.ts`의 `images.remotePatterns`에 도메인을 등록해야 합니다.
  - 현재 허용: `images.unsplash.com`, `api.dicebear.com`, Supabase Storage 도메인, `cdn.pixabay.com`
  - 새 도메인을 쓰면 `remotePatterns`에 추가합니다 (와일드카드 도메인은 피합니다).
- 화면 위쪽(LCP) 이미지에는 `priority`, 나머지는 기본 lazy loading을 유지하고, 반응형 이미지에는 `sizes`를 지정합니다.
- 내부 이동은 `next/link`의 `Link`, 코드 이동은 `useRouter`(Client) 또는 `redirect`(Server)를 사용합니다. 내부 링크에 `<a>`를 쓰지 않습니다.
- 폰트는 `next/font`(Geist)를 사용하고 `app/layout.tsx`에서 한 번만 적용합니다.

---

## 8. 로딩, 에러, 메타데이터

- 데이터를 조회하는 라우트에는 `loading.tsx`를 두고 `components/skeletons/*`를 사용합니다. 느린 영역은 `Suspense`로 분리합니다.
- 라우트 세그먼트별 `error.tsx`(Client Component)와 전역 `not-found.tsx`를 둡니다.
- 메타데이터는 `export const metadata` 또는 `generateMetadata`로 선언합니다. 이벤트 상세 등 공유되는 페이지는 Open Graph(제목, 설명, 커버 이미지)를 설정합니다.
- 개발 중 콘솔 경고(hydration mismatch, 키 누락 등)는 남기지 않습니다.

---

## 9. 성능 기준

- 번들 크기 최소화: 큰 라이브러리(Recharts 등)는 사용하는 페이지에서만 import하고, 필요하면 `next/dynamic`으로 지연 로딩합니다.
- 목록은 필요한 컬럼만 `select`하고, 페이지네이션/무한 스크롤로 한 번에 가져오는 양을 제한합니다.
- 목표: 모바일 FCP 1.5초 이하, TTI 3초 이하, Lighthouse 90+

---

## 10. 작업 전후 체크리스트

- [ ] `params`/`searchParams`/`cookies()`를 `await` 했는가
- [ ] 불필요한 `'use client'`가 없는가
- [ ] Server Action에서 입력 검증과 권한 확인을 했는가
- [ ] 변경 후 `revalidatePath`를 호출했는가
- [ ] 외부 이미지 도메인이 `remotePatterns`에 등록되어 있는가
- [ ] `npm run check-all`과 `npm run build`가 통과하는가
