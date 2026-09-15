# 카탈로그 시드 확장 — 인계 노트 (2026-09-15)

## 왜 이 문서가 있는가

`server/db/seed.js`의 국산 6개 브랜드 카탈로그 확장 작업 도중, 이 세션의
WebSearch 호출 예산이 소진(200/200)되어 더 이상 웹 검색으로 세대/연도를
검증할 수 없게 됐다. 사용자의 하드 요구사항은 "세대 코드와 생산 연도는
기억이 아니라 웹 검색으로 확인"이므로, 검증 안 된 데이터를 검증된 것처럼
남겨두면 안 된다. 이 문서는 브랜드별 검증 상태를 정확히 기록하고, 새 세션에서
바로 이어받을 수 있게 인계 프롬프트를 제공한다.

## 브랜드별 상태

| 브랜드 | 상태 | 위치 | 비고 |
|---|---|---|---|
| 현대 | ✅ 웹 검증 완료 | `seed.js`에 커밋됨 (`334aaf8`) | 5개 모델그룹, 30개 세대 행, 55개 트림. 실제 서브에이전트 웹 검색 리서치 기반. |
| 기아 | ⚠️ **미검증** (기억 기반 초안) | `seed.js`에 커밋됨 (`6efa1f4`) + 블록 상단에 미검증 주석 추가함 | 5개 모델그룹, 28개 세대 행, 49개 트림. 재검증 필요. |
| 제네시스 | ⚠️ **미검증** (기억 기반 초안) | 커밋 안 됨 — 아래 "제네시스 초안" 섹션에 원문 보존 | seed.js는 원래(placeholder) 상태로 되돌려둠. |
| KG모빌리티 | ❌ 미작성 | 없음 (placeholder만 존재) | 토레스/렉스턴 스포츠/코란도/티볼리 — 처음부터 작성 필요. |
| 르노코리아 | ❌ 미작성 | 없음 (placeholder만 존재) | SM6/QM6/XM3/SM5 — 처음부터 작성 필요. |
| 쉐보레 | ❌ 미작성 | 없음 (CATALOG에 브랜드 자체가 없음) | 트레일블레이저/트랙스/말리부/스파크/이쿼녹스 — 신규 추가. |

검증 시도 로그: 제네시스/KG모빌리티/르노코리아/쉐보레/기아(재검증) 총 5개
서브에이전트를 동시 디스패치했으나, 세션 공유 WebSearch 예산이 이미
0/200이라 전부 검색 없이 실패 보고함 (일부는 시도조차 못 하고 즉시 실패).

## 참고: 이 저장소에 이미 있던 별개의 미커밋 작업

`git status`에서 seed.js 외에도 다음 파일들이 **이미 이전 세션부터 커밋되지
않은 상태**로 남아있었다 (이번 세션에서 건드리지 않음, 그대로 보존):
`client/src/api/cars.ts`, `client/src/components/CarCard.tsx`,
`client/src/pages/CarDetailPage.tsx`, `client/src/pages/CarFormPage.tsx`,
`client/src/pages/CarListPage.tsx`, `client/src/pages/SearchResultsPage.tsx`,
`server/__tests__/cars.test.js`, `server/__tests__/schemaMigration.test.js`,
`server/db/schema.js`, `server/routes/cars.js`. 이건 post-merge 버그
수정/design change(최근 본 조건 라벨링, 가격 leading-zero, 지역 select,
display_title) 작업 결과로 보이며 아직 커밋되지 않았다. 시드 작업과는
무관하니 별도로 커밋 여부를 확인할 것 — 잃어버리면 안 되는 작업이다.

## 제네시스 초안 (미검증 — 참고용, seed.js에는 없음)

아래는 기억 기반으로 작성했던 초안이다. 다음 세션에서 웹 검색으로
재검증한 뒤 `seed.js`의 제네시스 블록(현재 `RG3` 1개 행짜리 placeholder)을
이걸로 교체하거나, 검증 결과에 맞게 새로 작성할 것.

```js
{
  manufacturer: '제네시스',
  modelGroups: [
    {
      name: 'G80',
      models: [
        {
          name: 'G80 (RG3)',
          powertrain: '일반',
          startYear: 2020,
          endYear: 2023, // 월 불확실(초안 당시 가정, 재검증 필요)
          trims: [
            { name: '가솔린 2.5 터보 프리미엄', fuelType: '가솔린', transmission: '자동' },
            { name: '가솔린 3.5 터보 스포츠', fuelType: '가솔린', transmission: '자동' },
          ],
        },
        {
          name: '더 뉴 G80 (RG3)',
          powertrain: '일반',
          startYear: 2023,
          endYear: null,
          trims: [
            { name: '가솔린 2.5 터보 프리미엄', fuelType: '가솔린', transmission: '자동' },
            { name: '가솔린 3.5 터보 스포츠', fuelType: '가솔린', transmission: '자동' },
          ],
        },
        {
          name: '더 뉴 G80 전동화 (RG3)',
          powertrain: '전기',
          startYear: 2023,
          endYear: null,
          trims: [{ name: '전기 스탠다드', fuelType: '전기', transmission: '자동' }],
        },
      ],
    },
    {
      name: 'G70',
      models: [
        {
          name: 'G70 (IK)',
          powertrain: '일반',
          startYear: 2017,
          endYear: 2020,
          trims: [
            { name: '가솔린 2.0 터보 스탠다드', fuelType: '가솔린', transmission: '자동' },
            { name: '가솔린 3.3 터보 스포츠', fuelType: '가솔린', transmission: '자동' },
          ],
        },
        {
          name: '더 뉴 G70 (IK)',
          powertrain: '일반',
          startYear: 2021,
          endYear: null,
          trims: [
            { name: '가솔린 2.0 터보 스탠다드', fuelType: '가솔린', transmission: '자동' },
            { name: '가솔린 3.3 터보 스포츠', fuelType: '가솔린', transmission: '자동' },
          ],
        },
      ],
    },
    {
      name: 'GV70',
      models: [
        {
          name: 'GV70 (JK1)',
          powertrain: '일반',
          startYear: 2020,
          endYear: null,
          trims: [
            { name: '가솔린 2.5 터보 프리미엄', fuelType: '가솔린', transmission: '자동' },
            { name: '가솔린 3.5 터보 스포츠', fuelType: '가솔린', transmission: '자동' },
          ],
        },
        {
          name: 'GV70 전동화 (JK1)',
          powertrain: '전기',
          startYear: 2021,
          endYear: null,
          trims: [{ name: '전기 스탠다드', fuelType: '전기', transmission: '자동' }],
        },
      ],
    },
    {
      name: 'GV80',
      models: [
        {
          name: 'GV80 (JX1)',
          powertrain: '일반',
          startYear: 2020,
          endYear: null,
          trims: [
            { name: '디젤 3.0 프리미엄', fuelType: '디젤', transmission: '자동' },
            { name: '가솔린 3.5 터보 스포츠', fuelType: '가솔린', transmission: '자동' },
          ],
        },
        {
          name: 'GV80 쿠페 (JX1)',
          powertrain: '일반',
          startYear: 2023,
          endYear: null,
          trims: [{ name: '가솔린 3.5 터보 스포츠', fuelType: '가솔린', transmission: '자동' }],
        },
      ],
    },
  ],
},
```

(참고: 이 초안은 4개 모델그룹, 9개 세대 행. 이전 세션에서 사용자가 승인한
104개 총계 산정 당시엔 제네시스가 12개 행으로 계산되어 있었다 — 이 초안과는
다르므로, 재검증 시 실제 리서치 결과를 기준으로 삼고 이 숫자에 얽매이지 말 것.)

## 세대 구분 규칙 (반드시 지킬 것)

1. **브랜드당 모델그룹 4~6개**, 모델그룹당 **최근 2개의 루트 세대(풀체인지)만** 포함.
   그 안에서 페이스리프트/하이브리드 파생은 별도 행으로 추가 가능.
2. **하이브리드는 일반 모델과 반드시 동일한 페이스리프트 경계로 나눈다.**
   일반이 페이스리프트로 나뉘면 하이브리드도 나누고, 일반이 안 나뉘면
   하이브리드도 안 나눈다. 파워트레인마다 다른 분리 기준을 쓰지 않는다.
3. **불확실 항목은 전부 제외**: 2026년 출시(예정 포함) 건, 단일 출처만
   있는 항목, 출처가 서로 상충하는 항목, "오늘 날짜" 속보성 항목.
4. **연도는 확실하나 정확한 월은 불확실**한 항목은 제외하지 말고, 대신
   `// 월 불확실: <사유>` 형식의 인라인 주석을 `endYear`(또는 `startYear`)
   줄에 남긴다. 현대 블록의 `아반떼 하이브리드 (CN7)` 행이 실제 예시다.
5. **모든 세대코드/연도/페이스리프트 시점/트림명은 WebSearch로 확인한 뒤에만
   seed.js에 채운다.** 기억만으로 채운 초안은 커밋하지 않거나, 커밋한다면
   반드시 "⚠️ 미검증" 주석을 블록 상단에 남긴다 (기아 블록 참고).

## 커밋 방식

`seed.js`에 한 번에 다 넣지 말고 **브랜드 단위로 커밋**한다. 문제가 생기면
어느 브랜드에서 깨졌는지 바로 보이게 하기 위함.

## 검증 스크립트 요구사항 (모든 브랜드 작성 후 실행)

새 파일(예: `server/scripts/validateCatalog.js`)을 작성해서 아래 4가지를
검사하고, **전부 0건**이어야 한다:

1. `start_year > end_year`인 세대 행
2. 같은 `model_group` 안에서 생산기간(start_year~end_year)이 겹치는 세대
   (단, 같은 세대의 일반/하이브리드/전기 파생끼리는 겹쳐도 정상 — 겹침
   판정은 "서로 다른 루트 세대" 사이에서만 봐야 함)
3. `end_year`가 미래(오늘 기준 2026-09-15, 즉 `end_year > 2026`)인 행
4. 트림이 0개인 세대

## 다음 세션에 그대로 붙여넣을 인계 프롬프트

```
ch05(/Users/uida/claude-project/ch05)의 중고차 마켓 시드 데이터 확장을
이어서 진행해줘. docs/superpowers/notes/2026-09-15-catalog-seed-handoff.md
문서를 먼저 읽고 시작할 것 — 브랜드별 검증 상태, 세대 구분 규칙, 남은
작업이 전부 정리되어 있음.

핵심 규칙 요약:
- 브랜드당 모델그룹 4~6개, 모델그룹당 최근 2개 루트 세대만.
- 하이브리드는 일반과 동일한 페이스리프트 경계로 분리 (다른 기준 금지).
- 2026년 출시/단일 출처/출처 상충 항목은 전부 제외.
- 연도 확실·월 불확실 항목은 제외 대신 "// 월 불확실: <사유>" 주석 표기.
- 모든 세대코드/연도/트림명은 반드시 WebSearch로 확인 후 채울 것 — 기억만으로
  채우지 말 것 (이전 세션에서 WebSearch 예산 소진으로 기아·제네시스가
  미검증 상태로 남았음, 문서의 상태표 참고).
- 브랜드 단위로 개별 커밋.

작업 순서:
1. 기아(server/db/seed.js, 커밋 6efa1f4) 재검증 — 블록 상단 "⚠️ 미검증"
   주석 참고. 틀린 부분 있으면 수정 후 새 커밋.
2. 제네시스 — 문서의 "제네시스 초안" 섹션을 참고하되, 반드시 웹 검색으로
   재검증한 뒤 seed.js에 반영, 커밋.
3. KG모빌리티(토레스/렉스턴 스포츠/코란도/티볼리) 신규 작성, 웹 검색 검증, 커밋.
4. 르노코리아(SM6/QM6/XM3/SM5) 신규 작성, 웹 검색 검증, 커밋.
5. 쉐보레(트레일블레이저/트랙스/말리부/스파크/이쿼녹스) — CATALOG에 브랜드
   자체를 새로 추가, 웹 검색 검증, 커밋.
6. 전체 완료 후 server/scripts/validateCatalog.js 작성 — start_year>end_year,
   model_group 내 겹치는 세대(같은 세대의 파워트레인 파생끼리는 제외),
   미래 end_year(>2026), 트림 0개 세대를 각각 검사. 실행해서 4개 항목 전부
   0건인지 확인하고 결과 보고.

주의: server/db/seed.js 외에도 client/src/api/cars.ts,
client/src/components/CarCard.tsx, client/src/pages/CarDetailPage.tsx,
client/src/pages/CarFormPage.tsx, client/src/pages/CarListPage.tsx,
client/src/pages/SearchResultsPage.tsx, server/__tests__/cars.test.js,
server/__tests__/schemaMigration.test.js, server/db/schema.js,
server/routes/cars.js 가 이미 커밋되지 않은 상태로 남아있음(시드 작업과는
무관한 이전 버그수정 작업). 실수로 되돌리지 말고, 시드 작업과 분리해서
다룰 것.
```
