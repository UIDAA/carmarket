---
name: commit-convention
description: Conventional Commits 규칙에 맞춰 git 커밋 메시지를 작성하고 커밋한다. "커밋해줘", "커밋 메시지 만들어줘", "컨벤션대로 커밋" 같은 요청에 사용.
---

# 커밋 컨벤션 스킬

staged/unstaged 변경 사항을 분석해서 [Conventional Commits](https://www.conventionalcommits.org/) 형식의 커밋 메시지를 작성하고 커밋한다.

## 메시지 형식

```
<type>(<scope>): <subject>

<body (선택)>

<footer (선택)>
```

- `subject`는 명령형, 소문자 시작, 끝에 마침표 없음, 50자 이내
- `scope`는 변경된 영역 (예: `server`, `client`, `db`, `routes`) — 없으면 생략 가능
- `body`는 무엇을·왜 바꿨는지, 72자 내외로 줄바꿈
- Breaking change가 있으면 footer에 `BREAKING CHANGE: <설명>` 추가

## type 목록

| type | 용도 |
|---|---|
| feat | 새 기능 추가 |
| fix | 버그 수정 |
| docs | 문서만 변경 |
| style | 포맷팅, 세미콜론 등 (로직 변경 없음) |
| refactor | 기능 변경 없는 코드 구조 개선 |
| perf | 성능 개선 |
| test | 테스트 추가/수정 |
| chore | 빌드, 설정, 패키지 등 잡무성 변경 |
| ci | CI 설정 변경 |

## 절차

1. `git status`, `git diff HEAD`로 변경 내용을 확인한다.
2. 변경 성격에 맞는 `type`과 `scope`를 정한다.
3. 여러 종류의 변경이 섞여 있으면, 가능하면 커밋을 나누는 것을 제안한다. 나누기 애매하면 가장 비중이 큰 변경 기준으로 하나의 커밋을 만든다.
4. 위 형식으로 커밋 메시지를 작성하고 `git add`, `git commit`을 실행한다.
5. 커밋 메시지를 지어내지 않는다 — 실제 diff 내용에 근거해서 작성한다.
