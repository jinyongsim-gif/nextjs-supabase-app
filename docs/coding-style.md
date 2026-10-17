# 코딩 스타일 가이드

이 프로젝트의 TypeScript / React 코드 작성 기준입니다.
포맷은 **Prettier**, 정적 검사는 **ESLint + TypeScript**가 강제하므로, 이 문서는 도구가 잡아주지 못하는 규칙 위주로 정리합니다.

관련 문서: [CLAUDE.md](../CLAUDE.md) · [next-js.md](./next-js.md) · [supabase.md](./supabase.md)

---

## 1. 자동화 도구 (먼저 확인)

| 도구 | 설정 | 역할 |
|------|------|------|
| Prettier | `.prettierrc.json` | 포맷 (아래 값 참조) |
| ESLint | `eslint.config.mjs` (`next/core-web-vitals`, `next/typescript`, `prettier`) | 문법/React/Next 규칙 |
| TypeScript | `tsconfig.json` | `strict`, `noUnusedLocals`, `noUnusedParameters` |
| Husky + lint-staged | `.lintstagedrc.json` | 커밋 시 스테이지된 파일에 ESLint + Prettier 자동 실행 |

### Prettier 설정 요약

| 항목 | 값 |
|------|----|
| 들여쓰기 | 스페이스 2칸 |
| 한 줄 최대 길이 | 100자 |
| 세미콜론 | 사용 |
| 따옴표 | 큰따옴표 (`"`) |
| 후행 쉼표 | `es5` |
| 화살표 함수 인자 괄호 | 항상 (`(x) => x`) |
| Tailwind 클래스 정렬 | `prettier-plugin-tailwindcss`가 자동 정렬 |

### 명령어

```bash
npm run format       # Prettier 적용
npm run lint:fix     # ESLint 자동 수정
npm run check-all    # typecheck + lint + format:check (커밋/PR 전 필수)
```

> 포맷 때문에 코드 리뷰에서 논쟁하지 않습니다. `npm run format`의 결과가 정답입니다.

---

## 2. 네이밍 규칙

| 대상 | 규칙 | 예시 |
|------|------|------|
| 변수, 매개변수 | camelCase | `eventDate`, `inviteCode` |
| 함수 | camelCase, **동사로 시작** | `getEventDetail`, `handleSubmit`, `formatDate` |
| 불리언 | `is` / `has` / `can` / `should` 접두사 | `isHost`, `hasJoined`, `canEdit` |
| 컴포넌트 | PascalCase | `EventCard`, `ShareDialog` |
| 타입, 인터페이스 | PascalCase (`I` 접두사 금지) | `EventWithHost`, `ActionResult` |
| 상수 (모듈 수준 불변 값) | UPPER_SNAKE_CASE | `MAX_FILE_SIZE`, `ALLOWED_IMAGE_TYPES` |
| 파일, 폴더 | kebab-case | `event-card.tsx`, `invite-code.ts` |
| Zod 스키마 | `<이름>Schema` | `eventFormSchema` |
| Server Action | `<동사><대상>Action` 또는 동사형 | `uploadCoverImageAction`, `createEvent` |
| 이벤트 핸들러 | 정의는 `handle*`, props는 `on*` | `handleClick` / `onClick`, `onConfirm` |

### 규칙 설명

- 함수명은 **무엇을 하는지** 드러나는 동사로 시작합니다: `get`, `set`, `create`, `update`, `delete`, `fetch`, `handle`, `format`, `validate`, `is`, `has`.
- 약어는 널리 쓰이는 것만 허용합니다 (`id`, `url`, `props`). `evt`, `usr`, `tmp` 같은 임의 축약은 금지합니다.
- DB 컬럼명(snake_case)은 `database.types.ts`를 따릅니다. 앱 내부에서 새로 만드는 변수는 camelCase로 변환해 사용합니다.
- 컴포넌트 파일 하나에는 주 컴포넌트 하나를 두고, 파일명은 컴포넌트명을 kebab-case로 바꾼 값과 일치시킵니다 (`EventCard` → `event-card.tsx`).

---

## 3. TypeScript

- `strict` 모드를 지킵니다. 사용하지 않는 변수/매개변수는 남기지 않습니다 (의도적이면 `_` 접두사).
- **`any`를 쓰지 않습니다.** 타입을 모르면 `unknown`을 쓰고 좁혀서 사용합니다.
- 객체 형태는 `interface` 또는 `type`을 쓰되 한 가지로 통일합니다: 확장이 필요한 객체는 `interface`, 유니온/유틸리티 조합은 `type`.
- 타입만 가져올 때는 `import type`을 사용합니다.

```typescript
import type { ParticipantWithUser } from "@/lib/types/models";
```

- DB 타입은 직접 정의하지 않고 `lib/supabase/database.types.ts`의 `Tables<"events">`, `TablesInsert<"events">` 등을 기반으로 확장합니다.
- 폼 타입은 Zod 스키마에서 추론합니다: `type EventFormValues = z.infer<typeof eventFormSchema>`.
- 비null 단언(`!`)은 환경 변수처럼 존재가 보장되는 경우에만 사용하고, 그 외에는 null 검사를 합니다.
- 반환 타입은 공개 함수(export)에 명시하고, 짧은 내부 함수는 추론에 맡깁니다.
- 타입 정의 위치: `lib/types/{models,api,forms,components,admin,utils}.ts`

---

## 4. 파일 구성과 import

### import 순서

1. React / Next.js
2. 외부 라이브러리
3. `@/components/*`
4. `@/lib/*`
5. 타입 (`import type`)

```typescript
import Image from "next/image";
import { redirect } from "next/navigation";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getEventDetail } from "@/lib/queries/events";
import type { ParticipantWithUser } from "@/lib/types/models";
```

- 경로는 `@/` 별칭을 사용하고, `../../` 같은 깊은 상대 경로는 쓰지 않습니다.
- 사용하지 않는 import는 제거합니다.
- default export는 Next.js 규약 파일(`page`, `layout`)에서만 사용하고, 그 외 컴포넌트·함수는 **named export**를 사용합니다.

### 파일 내부 순서

1. `"use client"` / `"use server"` 지시문
2. import
3. 상수, 타입
4. 주 컴포넌트 / 함수
5. 파일 내부 전용 보조 함수

> `"use server"`는 이 프로젝트의 기존 Server Action 파일처럼 파일 최상단에 두고, 지시문은 한 파일에 한 번만 선언합니다.

---

## 5. React 컴포넌트

- **함수 컴포넌트**만 사용합니다. 클래스 컴포넌트는 쓰지 않습니다.
- Props 타입은 컴포넌트 바로 위에 `interface <컴포넌트명>Props`로 정의합니다.
- Props는 구조 분해로 받고, 기본값은 구조 분해에서 지정합니다.

```tsx
interface EventCardProps {
  event: EventWithHost;
  showStatus?: boolean;
}

export function EventCard({ event, showStatus = true }: EventCardProps) {
  return (
    <Card>
      <CardContent>{event.title}</CardContent>
    </Card>
  );
}
```

- 컴포넌트는 **단일 책임**을 지키고, 한 파일이 약 200줄을 넘으면 분리를 검토합니다.
- 조건부 렌더링은 단순하면 `&&` / 삼항, 복잡하면 early return이나 별도 컴포넌트로 분리합니다.
- 삼항을 중첩하지 않습니다.
- 목록 렌더링의 `key`는 안정적인 id를 사용하고, 배열 index는 쓰지 않습니다.
- `useEffect`는 외부 시스템과 동기화(구독, 브라우저 API)에만 사용합니다. 파생 값은 렌더링 중에 계산합니다.
- 서버 상태 변경은 Server Action + `useActionState`로 처리하고, 불필요한 전역 상태를 만들지 않습니다.
- 상세 패턴은 [guides/component-patterns.md](./guides/component-patterns.md)를 참조합니다.

---

## 6. 스타일링 (Tailwind CSS v4 + shadcn/ui)

- 스타일은 **Tailwind 유틸리티 클래스**로 작성합니다. 인라인 `style`과 별도 CSS 파일은 지양합니다.
- 클래스 조건 결합은 `lib/utils.ts`의 `cn()`을 사용합니다.

```tsx
<div className={cn("rounded-lg border p-4", isActive && "border-primary bg-primary/5")} />
```

- 색상은 하드코딩(`#fff`, `bg-blue-500`)하지 않고 테마 토큰(`bg-background`, `text-foreground`, `text-muted-foreground`, `border`)을 사용해 **다크 모드가 자동 적용**되게 합니다.
- 모바일 우선으로 작성하고 `sm:`, `md:`, `lg:` 접두사로 확장합니다.
- 모바일의 터치 대상은 높이 48px(`min-h-12`) 이상을 유지합니다.
- 클래스 순서는 Prettier 플러그인이 정렬하므로 직접 맞추지 않습니다.
- UI는 `components/ui/*`(shadcn/ui)를 먼저 사용하고, 없으면 `npx shadcn@latest add`로 추가합니다. `components/ui` 파일을 직접 수정할 때는 이유를 주석으로 남깁니다.
- 아이콘은 `lucide-react`만 사용하고, 아이콘만 있는 버튼에는 `aria-label`을 붙입니다.

---

## 7. 주석과 문서화 (한국어)

- 주석은 **한국어**로 작성합니다. 코드가 무엇을 하는지가 아니라 **왜 그렇게 했는지**를 설명합니다.
- 공개 함수, Server Action, 컴포넌트, 유틸리티에는 JSDoc을 작성합니다 (기존 코드 패턴과 동일).

```typescript
/**
 * ISO 날짜 문자열을 한국어 형식으로 변환
 *
 * @param dateString - ISO 8601 형식의 날짜 문자열
 * @returns "2025년 1월 15일 오전 10:00" 형식의 문자열
 *
 * @example
 * formatDate("2025-01-15T10:00:00.000Z")
 */
export function formatDate(dateString: string): string {
  // ...
}
```

- 코드와 모순되는 주석은 삭제하거나 고칩니다. 주석 처리한 죽은 코드는 남기지 않습니다 (git 이력이 있습니다).
- `TODO`는 `// TODO: 내용` 형식으로 남기고, 오래 두지 않습니다.

---

## 8. 에러 처리와 로깅

- 예상 가능한 실패(검증 실패, 권한 없음, 중복)는 throw하지 않고 `ActionResult`로 반환합니다 (`lib/types/forms.ts`).

```typescript
// 성공
return { success: true, message: "이벤트가 생성되었습니다.", data: { id } };
// 실패
return { success: false, message: "로그인이 필요합니다." };
// 필드별 검증 실패
return { success: false, message: "입력값을 확인해주세요.", errors: { title: ["제목은 필수입니다."] } };
```

- 외부 호출(Supabase, 파일 업로드)은 `error`를 항상 확인합니다.
- 사용자에게 보이는 메시지는 **한국어**이고, 내부 에러 문구나 스택은 노출하지 않습니다.
- `console.log`는 커밋하지 않습니다. 서버 로그가 꼭 필요하면 `console.error` / `console.warn`에 `[ADMIN]`처럼 접두사를 붙입니다.
- 비밀 값, 토큰, 이메일 등 개인정보는 로그에 남기지 않습니다.
- 사용자 알림은 `lib/utils/toast.ts`(Sonner)를 사용합니다.

---

## 9. 함수와 로직 작성

- 함수는 한 가지 일만 하고, 깊은 중첩 대신 **early return**을 사용합니다.

```typescript
if (!user) return { success: false, message: "로그인이 필요합니다." };
if (!isHost) return { success: false, message: "권한이 없습니다." };
// 정상 흐름
```

- 매직 넘버/문자열은 이름 있는 상수로 뺍니다 (`MAX_FILE_SIZE = 5 * 1024 * 1024`).
- 날짜/문자열 포맷은 `lib/utils/date.ts`, `lib/utils/format.ts`를 재사용하고 중복 구현하지 않습니다.
- 비동기 코드는 `async/await`를 사용하고, 서로 독립적인 호출은 `Promise.all`로 병렬 처리합니다.
- 입력 검증은 Zod 스키마(`lib/schemas/*`)에서 하고, 클라이언트와 서버가 같은 스키마를 공유합니다.
- 불변성을 우선합니다: `const`를 기본으로 사용하고, 배열/객체는 원본을 변경하지 않고 새로 만듭니다.
- 동등 비교는 `===` / `!==`를 사용합니다.

---

## 10. Git 커밋 전 체크

- 브랜치명: `feature/기능명`
- 커밋 메시지: 한국어, 이모지 + 컨벤셔널 형식 (예: `✨ feat: 구글 소셜 로그인 추가`)

| 이모지 | 타입 | 용도 |
|--------|------|------|
| ✨ | feat | 새 기능 |
| 🐛 | fix | 버그 수정 |
| ♻️ | refactor | 리팩토링 |
| 💄 | style | 포맷/스타일 |
| 📝 | docs | 문서 |
| ✅ | test | 테스트 |
| 🔧 | chore | 설정/도구 |

### 커밋 전 체크리스트

- [ ] `npm run lint` 통과 (커밋 전 린트는 필수)
- [ ] `npm run check-all` 통과
- [ ] `any`, `console.log`, 주석 처리된 코드가 남아있지 않은가
- [ ] 새 공개 함수/컴포넌트에 한국어 JSDoc이 있는가
- [ ] 하드코딩된 색상 없이 테마 토큰을 사용했는가
- [ ] 비밀 값이 코드나 문서에 들어가지 않았는가
