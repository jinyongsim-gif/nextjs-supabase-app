// Claude Code 훅 스크립트: 보호 파일 수정 차단(pre) / 수정 파일 자동 포맷(post)
// 사용법: node guard-and-format.mjs <pre|post>  (stdin으로 훅 JSON 입력)
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const mode = process.argv[2];
const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const filePath = String(input.tool_input?.file_path ?? "").replaceAll(
  "\\",
  "/",
);

// 직접 수정하면 안 되는 파일 (환경변수, 락파일, 생성된 타입)
const protectedPatterns = [
  /(^|\/)\.env(\.|$)/,
  /(^|\/)package-lock\.json$/,
  /(^|\/)types\/database\.types\.ts$/,
];

if (mode === "pre") {
  if (protectedPatterns.some((pattern) => pattern.test(filePath))) {
    console.error(`보호된 파일은 직접 수정할 수 없습니다: ${filePath}`);
    process.exit(2); // exit 2: 도구 실행 차단 + Claude에게 메시지 전달
  }
  process.exit(0);
}

if (mode === "post") {
  if (!/\.(ts|tsx|js|jsx|mjs|json|css|md)$/.test(filePath)) process.exit(0);
  const run = (args) =>
    spawnSync("npx", args, { stdio: "inherit", shell: true });
  if (/\.(ts|tsx|js|jsx|mjs)$/.test(filePath)) {
    run(["eslint", "--fix", `"${filePath}"`]);
  }
  run(["prettier", "--write", `"${filePath}"`]);
}
