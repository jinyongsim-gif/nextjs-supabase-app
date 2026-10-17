#!/bin/bash
# Claude Code Notification 훅 - 권한 요청 및 사용자 입력 대기 알림
#
# 이 스크립트는 Claude Code가 Notification 이벤트를 발생시킬 때 실행됩니다.
# 주로 권한 요청이나 사용자 입력 대기 상황에서 Slack 알림을 보냅니다.

# .env.local(우선) 또는 .env 파일에서 Slack 웹훅 URL 로드
ENV_FILE=""
for candidate in "$CLAUDE_PROJECT_DIR/.env.local" "$CLAUDE_PROJECT_DIR/.env"; do
    if [ -f "$candidate" ]; then
        ENV_FILE="$candidate"
        break
    fi
done

if [ -z "$ENV_FILE" ]; then
    echo "오류: .env.local 또는 .env 파일을 찾을 수 없습니다: $CLAUDE_PROJECT_DIR" >&2
    exit 1
fi

# Windows(CRLF)에서 만든 파일도 읽을 수 있도록 캐리지 리턴 제거
source <(tr -d '\r' < "$ENV_FILE")

# Slack 웹훅 URL 확인
if [ -z "$SLACK_WEBHOOK_URL" ]; then
    echo "오류: SLACK_WEBHOOK_URL이 설정되지 않았습니다." >&2
    exit 1
fi

# JSON 입력에서 메시지 추출 (있는 경우)
MESSAGE=$(jq -r '.message')

# 프로젝트명 추출
PROJECT_NAME=$(basename "$CLAUDE_PROJECT_DIR")

# 현재 시간
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# 디버깅을 위한 변수 출력 (stderr로 출력)
echo "DEBUG: MESSAGE = '$MESSAGE'" >&2
echo "DEBUG: PROJECT_NAME = '$PROJECT_NAME'" >&2
echo "DEBUG: TIMESTAMP = '$TIMESTAMP'" >&2

# JSON payload 생성
PAYLOAD=$(jq -n \
  --arg project "$PROJECT_NAME" \
  --arg message "$MESSAGE" \
  --arg time "$TIMESTAMP" \
  '{username: "Claude Code", icon_emoji: ":bell:", text: "🔔 권한 요청 알림\n\n프로젝트: \($project)\n상태: \($message)\n시간: \($time)\n\nClaude Code에서 알림이 도착했습니다."}')

echo "DEBUG: PAYLOAD = '$PAYLOAD'" >&2

# Slack으로 알림 전송
curl -sf -X POST \
  -H 'Content-Type: application/json' \
  --data "$PAYLOAD" \
  "$SLACK_WEBHOOK_URL" > /dev/null 2>&1

# 성공 여부 확인
if [ $? -eq 0 ]; then
    echo "Slack 알림이 성공적으로 전송되었습니다." >&2
else
    echo "Slack 알림 전송에 실패했습니다." >&2
    exit 1
fi