import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = [
  // 빌드 결과물, 생성 파일 등 린트 대상이 아닌 경로 제외
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "types/database.types.ts",
      "shrimp_data/**",
      ".claude/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // 타입 전용 import는 type 키워드로 구분
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      // 의도적으로 미사용인 변수는 _ 접두사 허용
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always"],
      // 변수/함수는 camelCase, 컴포넌트는 PascalCase, 상수는 UPPER_CASE 허용
      "@typescript-eslint/naming-convention": [
        "warn",
        // 외부 API(예: Supabase 쿼리 파라미터)의 snake_case 구조분해는 허용
        {
          selector: "variable",
          modifiers: ["destructured"],
          format: null,
        },
        {
          selector: "variable",
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
        },
        {
          selector: "function",
          format: ["camelCase", "PascalCase"],
        },
      ],
    },
  },
  // 포맷 규칙 충돌 제거 (항상 마지막에 위치)
  prettier,
];

export default eslintConfig;
