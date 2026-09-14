#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash)
# Fires every time Claude Code is about to run the Bash tool.
# Deterministically blocks any `git add` invocation that would stage .env,
# before the command ever executes. No model judgment involved.

input="$(cat)"
command="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"

[ -z "$command" ] && exit 0

# Does this command invoke `git ... add` (allowing flags like -C dir, --git-dir=x)?
if ! printf '%s' "$command" | grep -Eq 'git([[:space:]]+-[A-Za-z-]+(=[^[:space:]]+|[[:space:]]+[^[:space:]]+)?)*[[:space:]]+add\b'; then
  exit 0
fi

blocked=false
reason=""

# Case 1: .env referenced explicitly anywhere in the command
# (.env, ./.env, path/.env, .env.local, .env.production, ...)
if printf '%s' "$command" | grep -Eq '(^|[/[:space:]])\.env([.[:space:]]|$)'; then
  blocked=true
  reason=".env 파일을 직접 git add 대상으로 지정했습니다."
fi

# Case 2: a broad add (-A, --all, -u, "git add .", "git add *") while .env exists on disk
if [ "$blocked" = false ] && printf '%s' "$command" | grep -Eq -- '(-A\b|--all\b|-u\b|add[[:space:]]+\.([[:space:]]|$)|add[[:space:]]+\*([[:space:]]|$))'; then
  if [ -f .env ]; then
    blocked=true
    reason="현재 디렉터리에 .env 파일이 있고, 이 git add 명령이 그 파일까지 포함할 수 있습니다."
  fi
fi

if [ "$blocked" = true ]; then
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s .env는 git add 대상에서 항상 제외됩니다."}}' "$reason"
  exit 0
fi

exit 0
