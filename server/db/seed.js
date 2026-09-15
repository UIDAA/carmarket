const { createDb } = require('./schema');
const { findOrCreate } = require('./findOrCreate');

// 아래 카탈로그는 나무위키/위키백과/다나와/카이즈유/현대차그룹 뉴스룸 등을 교차 확인해 채운
// 실제 세대 이력이다(2026-09 기준, 웹 검색 리서치). 브랜드당 "최근 2세대"만 남겼고, 단일 출처거나
// 출처가 상충하는 항목, 2026년 출시 건은 제외했다. "// 월 불확실" 주석이 붙은 항목은 연도는
// 교차 확인됐지만 정확한 월까지는 확인하지 못한 것 — 실 서비스용 데이터로 교체할 때 이 주석이
// 붙은 곳부터 다시 확인하면 된다.
const CATALOG = [
  {
    manufacturer: '현대',
    modelGroups: [
      {
        name: '아반떼',
        models: [
          {
            name: '아반떼 (AD)',
            powertrain: '일반',
            startYear: 2015,
            endYear: 2017,
            trims: [
              { name: '가솔린 1.6 스마트', fuelType: '가솔린', transmission: '자동' },
              { name: '디젤 1.6 프리미엄', fuelType: '디젤', transmission: '자동' },
            ],
          },
          {
            name: '더 뉴 아반떼 (AD)',
            powertrain: '일반',
            startYear: 2018,
            endYear: 2019,
            trims: [
              { name: '가솔린 1.6 스마트', fuelType: '가솔린', transmission: '자동' },
              { name: '가솔린 터보 1.6 스포츠', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            name: '아반떼 (CN7)',
            powertrain: '일반',
            startYear: 2020,
            endYear: 2022,
            trims: [
              { name: '가솔린 1.6 스마트', fuelType: '가솔린', transmission: '자동' },
              { name: '가솔린 터보 1.6 N라인', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            name: '아반떼 하이브리드 (CN7)',
            powertrain: '하이브리드',
            startYear: 2022,
            endYear: 2022, // 월 불확실: ino1 단일 출처("2022.03.08 출시") — 연도는 확실
            trims: [{ name: '하이브리드 1.6 모던', fuelType: '하이브리드', transmission: '자동' }],
          },
          {
            name: '더 뉴 아반떼 (CN7)',
            powertrain: '일반',
            startYear: 2023,
            endYear: 2025,
            trims: [
              { name: '가솔린 1.6 스마트', fuelType: '가솔린', transmission: '자동' },
              { name: '가솔린 터보 1.6 N라인', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            name: '더 뉴 아반떼 하이브리드 (CN7)',
            powertrain: '하이브리드',
            startYear: 2023,
            endYear: 2025,
            trims: [
              { name: '하이브리드 1.6 모던', fuelType: '하이브리드', transmission: '자동' },
              { name: '하이브리드 1.6 인스퍼레이션', fuelType: '하이브리드', transmission: '자동' },
            ],
          },
        ],
      },
      {
        name: '쏘나타',
        models: [
          {
            name: '쏘나타 (LF)',
            powertrain: '일반',
            startYear: 2014,
            endYear: 2016,
            trims: [
              { name: '가솔린 2.0 스마트', fuelType: '가솔린', transmission: '자동' },
              { name: '디젤 1.7 프리미엄', fuelType: '디젤', transmission: '자동' },
            ],
          },
          {
            name: '쏘나타 하이브리드 (LF)',
            powertrain: '하이브리드',
            startYear: 2015,
            endYear: 2016,
            trims: [{ name: '하이브리드 2.0 스마트', fuelType: '하이브리드', transmission: '자동' }],
          },
          {
            name: '쏘나타 뉴 라이즈 (LF)',
            powertrain: '일반',
            startYear: 2017,
            endYear: 2018,
            trims: [
              { name: '가솔린 2.0 스마트', fuelType: '가솔린', transmission: '자동' },
              { name: '가솔린 터보 2.0 스포츠', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            name: '쏘나타 뉴 라이즈 하이브리드 (LF)',
            powertrain: '하이브리드',
            startYear: 2017,
            endYear: 2018,
            trims: [{ name: '하이브리드 2.0 프리미엄', fuelType: '하이브리드', transmission: '자동' }],
          },
          {
            name: '쏘나타 (DN8)',
            powertrain: '일반',
            startYear: 2019,
            endYear: 2022,
            trims: [
              { name: '가솔린 2.0 스마트', fuelType: '가솔린', transmission: '자동' },
              { name: '가솔린 터보 2.5 센슈어스', fuelType: '가솔린', transmission: '자동' },
              { name: 'LPi 2.0 스마트', fuelType: 'LPG', transmission: '자동' },
            ],
          },
          {
            name: '쏘나타 디 엣지 (DN8)',
            powertrain: '일반',
            startYear: 2023,
            endYear: null,
            trims: [
              { name: '가솔린 2.0 스마트', fuelType: '가솔린', transmission: '자동' },
              { name: '가솔린 터보 2.5 N라인', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            name: '쏘나타 디 엣지 하이브리드 (DN8)',
            powertrain: '하이브리드',
            startYear: 2023,
            endYear: null,
            trims: [
              { name: '하이브리드 2.0 프리미엄', fuelType: '하이브리드', transmission: '자동' },
              { name: '하이브리드 2.0 인스퍼레이션', fuelType: '하이브리드', transmission: '자동' },
            ],
          },
        ],
      },
      {
        name: '그랜저',
        models: [
          {
            name: '그랜저 (IG)',
            powertrain: '일반',
            startYear: 2016,
            endYear: 2018,
            trims: [
              { name: '가솔린 2.4 스마트', fuelType: '가솔린', transmission: '자동' },
              { name: '디젤 2.2 프리미엄', fuelType: '디젤', transmission: '자동' },
            ],
          },
          {
            name: '그랜저 하이브리드 (IG)',
            powertrain: '하이브리드',
            startYear: 2017,
            endYear: 2018,
            trims: [{ name: '하이브리드 2.4 스마트', fuelType: '하이브리드', transmission: '자동' }],
          },
          {
            name: '더 뉴 그랜저 (IG)',
            powertrain: '일반',
            startYear: 2019,
            endYear: 2021,
            trims: [
              { name: '가솔린 2.4 스마트', fuelType: '가솔린', transmission: '자동' },
              { name: '가솔린 3.3 캘리그래피', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            name: '더 뉴 그랜저 하이브리드 (IG)',
            powertrain: '하이브리드',
            startYear: 2019,
            endYear: 2021,
            trims: [
              { name: '하이브리드 2.4 스마트', fuelType: '하이브리드', transmission: '자동' },
              { name: '하이브리드 2.4 캘리그래피', fuelType: '하이브리드', transmission: '자동' },
            ],
          },
          {
            name: '그랜저 (GN7)',
            powertrain: '일반',
            startYear: 2022,
            endYear: 2025,
            trims: [
              { name: '가솔린 2.5 스마트', fuelType: '가솔린', transmission: '자동' },
              { name: '가솔린 3.5 캘리그래피', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            name: '그랜저 하이브리드 (GN7)',
            powertrain: '하이브리드',
            startYear: 2022,
            endYear: 2025,
            trims: [
              { name: '하이브리드 1.6 터보 프리미엄', fuelType: '하이브리드', transmission: '자동' },
              { name: '하이브리드 1.6 터보 캘리그래피', fuelType: '하이브리드', transmission: '자동' },
            ],
          },
        ],
      },
      {
        name: '싼타페',
        models: [
          {
            name: '싼타페 (TM)',
            powertrain: '일반',
            startYear: 2018,
            endYear: 2019,
            trims: [
              { name: '가솔린 터보 2.0 스마트', fuelType: '가솔린', transmission: '자동' },
              { name: '디젤 2.2 프레스티지', fuelType: '디젤', transmission: '자동' },
            ],
          },
          {
            name: '더 뉴 싼타페 (TM)',
            powertrain: '일반',
            startYear: 2020,
            endYear: 2022,
            trims: [
              { name: '가솔린 터보 2.5 프레스티지', fuelType: '가솔린', transmission: '자동' },
              { name: '디젤 2.2 캘리그래피', fuelType: '디젤', transmission: '자동' },
            ],
          },
          {
            name: '더 뉴 싼타페 하이브리드 (TM)',
            powertrain: '하이브리드',
            startYear: 2021,
            endYear: 2022,
            trims: [{ name: '하이브리드 1.6 터보 프레스티지', fuelType: '하이브리드', transmission: '자동' }],
          },
          {
            name: '싼타페 (MX5)',
            powertrain: '일반',
            startYear: 2023,
            endYear: null,
            trims: [
              { name: '가솔린 터보 2.5 프레스티지', fuelType: '가솔린', transmission: '자동' },
              { name: '가솔린 터보 2.5 캘리그래피', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            name: '싼타페 하이브리드 (MX5)',
            powertrain: '하이브리드',
            startYear: 2023,
            endYear: null,
            trims: [
              { name: '하이브리드 1.6 터보 익스클루시브', fuelType: '하이브리드', transmission: '자동' },
              { name: '하이브리드 1.6 터보 캘리그래피', fuelType: '하이브리드', transmission: '자동' },
            ],
          },
        ],
      },
      {
        name: '투싼',
        models: [
          {
            name: '투싼 (TL)',
            powertrain: '일반',
            startYear: 2015,
            endYear: 2017,
            trims: [
              { name: '가솔린 2.0 스마트', fuelType: '가솔린', transmission: '자동' },
              { name: '디젤 2.0 프레스티지', fuelType: '디젤', transmission: '자동' },
            ],
          },
          {
            // 실제 공식 서브네임은 "더 뉴"가 아니라 그냥 "투싼"이었다(부산모터쇼 2018.06 공개) —
            // model_groups 내 UNIQUE 제약 때문에 이름을 그대로 둘 수 없어 괄호로 구분했다.
            name: '투싼 (TL 부분변경)',
            powertrain: '일반',
            startYear: 2018,
            endYear: 2019,
            trims: [
              { name: '가솔린 2.0 스마트', fuelType: '가솔린', transmission: '자동' },
              { name: '가솔린 터보 1.6 스포츠', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            name: '투싼 (NX4)',
            powertrain: '일반',
            startYear: 2020,
            endYear: 2022,
            trims: [
              { name: '가솔린 2.0 스마트', fuelType: '가솔린', transmission: '자동' },
              { name: '가솔린 터보 1.6 N라인', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            name: '투싼 하이브리드 (NX4)',
            powertrain: '하이브리드',
            startYear: 2020,
            endYear: 2022,
            trims: [{ name: '하이브리드 1.6 터보 모던', fuelType: '하이브리드', transmission: '자동' }],
          },
          {
            name: '더 뉴 투싼 (NX4)',
            powertrain: '일반',
            startYear: 2023,
            endYear: null,
            trims: [
              { name: '가솔린 2.0 스마트', fuelType: '가솔린', transmission: '자동' },
              { name: '가솔린 터보 1.6 N라인', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            name: '더 뉴 투싼 하이브리드 (NX4)',
            powertrain: '하이브리드',
            startYear: 2023,
            endYear: null,
            trims: [
              { name: '하이브리드 1.6 터보 모던', fuelType: '하이브리드', transmission: '자동' },
              { name: '하이브리드 1.6 터보 프레스티지', fuelType: '하이브리드', transmission: '자동' },
            ],
          },
        ],
      },
    ],
  },
  {
    // 웹 검증: 최초 초안은 기억으로 작성됐으나, WebSearch 예산 소진 후 WebFetch로
    // 위키백과/나무위키를 교차 확인해 재검증함. 이 과정에서 더 뉴 K5(JF) 종료연도 오류(2021→2019,
    // K5(DL3)와 겹치던 버그) 수정, 스포티지 더 볼드(QL) 기간 교차 확인, 스포티지 하이브리드(NQ5)는
    // 출처 상충으로 제외 처리함. 상세 내용은 docs/superpowers/notes/2026-09-15-catalog-seed-handoff.md.
    manufacturer: '기아',
    modelGroups: [
      {
        name: 'K5',
        models: [
          {
            name: 'K5 (JF)',
            powertrain: '일반',
            startYear: 2015,
            endYear: 2017,
            trims: [
              { name: '가솔린 2.0 스마트', fuelType: '가솔린', transmission: '자동' },
              { name: '디젤 1.7 프레스티지', fuelType: '디젤', transmission: '자동' },
            ],
          },
          {
            name: 'K5 하이브리드 (JF)',
            powertrain: '하이브리드',
            startYear: 2015,
            endYear: 2017,
            trims: [{ name: '하이브리드 2.0 노블레스', fuelType: '하이브리드', transmission: '자동' }],
          },
          {
            name: '더 뉴 K5 (JF)',
            powertrain: '일반',
            startYear: 2018,
            endYear: 2019, // 웹 검증: DL3(2019.11) 출시로 대체 — 최초 초안의 2021은 K5(DL3)와 겹치는 오류였음
            trims: [
              { name: '가솔린 2.0 스마트', fuelType: '가솔린', transmission: '자동' },
              { name: '가솔린 터보 1.6 GT라인', fuelType: '가솔린', transmission: 'DCT' },
            ],
          },
          {
            name: '더 뉴 K5 하이브리드 (JF)',
            powertrain: '하이브리드',
            startYear: 2018,
            endYear: 2019, // 월 불확실: 단종 시점은 후속 세대 출시일 기준 역산
            trims: [{ name: '하이브리드 2.0 프레스티지', fuelType: '하이브리드', transmission: '자동' }],
          },
          {
            name: 'K5 (DL3)',
            powertrain: '일반',
            startYear: 2019,
            endYear: 2022,
            trims: [
              { name: '가솔린 2.0 스마트', fuelType: '가솔린', transmission: '자동' },
              { name: 'LPG 2.0 프레스티지', fuelType: 'LPG', transmission: '자동' },
              { name: '가솔린 터보 1.6 GT라인', fuelType: '가솔린', transmission: 'DCT' },
            ],
          },
          {
            name: 'K5 하이브리드 (DL3)',
            powertrain: '하이브리드',
            startYear: 2020, // 월 불확실: 출시월 출처 상충(연도만 확정)
            endYear: 2022,
            trims: [{ name: '하이브리드 2.0 프레스티지', fuelType: '하이브리드', transmission: '자동' }],
          },
          {
            name: '더 뉴 K5 (DL3)',
            powertrain: '일반',
            startYear: 2023,
            endYear: null,
            trims: [
              { name: '가솔린 2.0 스마트', fuelType: '가솔린', transmission: '자동' },
              { name: '가솔린 터보 1.6 GT라인', fuelType: '가솔린', transmission: 'DCT' },
            ],
          },
          {
            name: '더 뉴 K5 하이브리드 (DL3)',
            powertrain: '하이브리드',
            startYear: 2023,
            endYear: null,
            trims: [
              { name: '하이브리드 2.0 프레스티지', fuelType: '하이브리드', transmission: '자동' },
              { name: '하이브리드 2.0 시그니처', fuelType: '하이브리드', transmission: '자동' },
            ],
          },
        ],
      },
      {
        name: '쏘렌토',
        models: [
          {
            name: '쏘렌토 (UM)',
            powertrain: '일반',
            startYear: 2014, // 월 불확실: 출시 정확한 월 미확인(연도는 확실)
            endYear: 2016,
            trims: [
              { name: '디젤 2.2 프레스티지', fuelType: '디젤', transmission: '자동' },
              { name: '가솔린 2.4 스마트', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            name: '더 뉴 쏘렌토 (UM)',
            powertrain: '일반',
            startYear: 2017,
            endYear: 2019,
            trims: [
              { name: '디젤 2.2 프레스티지', fuelType: '디젤', transmission: '자동' },
              { name: '가솔린 2.4 스마트', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            name: '쏘렌토 (MQ4)',
            powertrain: '일반',
            startYear: 2020,
            endYear: 2022,
            trims: [
              { name: '디젤 2.2 프레스티지', fuelType: '디젤', transmission: '자동' },
              { name: '가솔린 2.5 터보 시그니처', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            name: '쏘렌토 하이브리드 (MQ4)',
            powertrain: '하이브리드',
            startYear: 2020,
            endYear: 2022,
            trims: [{ name: '하이브리드 1.6 터보 노블레스', fuelType: '하이브리드', transmission: '자동' }],
          },
          {
            name: '더 뉴 쏘렌토 (MQ4)',
            powertrain: '일반',
            startYear: 2023,
            endYear: null,
            trims: [
              { name: '디젤 2.2 프레스티지', fuelType: '디젤', transmission: '자동' },
              { name: '가솔린 2.5 터보 시그니처', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            name: '더 뉴 쏘렌토 하이브리드 (MQ4)',
            powertrain: '하이브리드',
            startYear: 2023,
            endYear: null,
            trims: [
              { name: '하이브리드 1.6 터보 노블레스', fuelType: '하이브리드', transmission: '자동' },
              { name: '하이브리드 1.6 터보 그래비티', fuelType: '하이브리드', transmission: '자동' },
            ],
          },
        ],
      },
      {
        name: '스포티지',
        models: [
          {
            name: '스포티지 (QL)',
            powertrain: '일반',
            startYear: 2015,
            endYear: 2017,
            trims: [
              { name: '디젤 2.0 프레스티지', fuelType: '디젤', transmission: '자동' },
              { name: '가솔린 2.0 스마트', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            // 실제 공식 서브네임은 "스포티지 더 볼드"(2018.07 부분변경)
            name: '스포티지 더 볼드 (QL)',
            powertrain: '일반',
            startYear: 2018,
            endYear: 2020,
            trims: [
              { name: '디젤 2.0 프레스티지', fuelType: '디젤', transmission: '자동' },
              { name: '가솔린 터보 1.6 GT라인', fuelType: '가솔린', transmission: 'DCT' },
            ],
          },
          {
            name: '스포티지 (NQ5)',
            powertrain: '일반',
            startYear: 2021,
            endYear: 2023,
            trims: [
              { name: '디젤 2.0 프레스티지', fuelType: '디젤', transmission: '자동' },
              { name: '가솔린 터보 1.6 GT라인', fuelType: '가솔린', transmission: 'DCT' },
            ],
          },
          // 스포티지 하이브리드(NQ5) 행은 최초 출시 연도가 출처마다 상충해(2021~2022 vs
          // 공식 페이스리프트 2024) 규칙에 따라 제외함 — 재검증 시 기아 공식 보도자료로 확인 필요.
          {
            name: '더 뉴 스포티지 (NQ5)',
            powertrain: '일반',
            startYear: 2024,
            endYear: null,
            trims: [
              { name: '디젤 2.0 프레스티지', fuelType: '디젤', transmission: '자동' },
              { name: '가솔린 터보 1.6 GT라인', fuelType: '가솔린', transmission: 'DCT' },
            ],
          },
        ],
      },
      {
        name: '카니발',
        models: [
          {
            name: '올 뉴 카니발 (YP)',
            powertrain: '일반',
            startYear: 2014,
            endYear: 2017,
            trims: [
              { name: '디젤 2.2 프레스티지', fuelType: '디젤', transmission: '자동' },
              { name: '가솔린 3.3 노블레스', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            name: '더 뉴 카니발 (YP)',
            powertrain: '일반',
            startYear: 2018,
            endYear: 2020,
            trims: [
              { name: '디젤 2.2 프레스티지', fuelType: '디젤', transmission: '자동' },
              { name: '가솔린 3.3 노블레스', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            name: '카니발 (KA4)',
            powertrain: '일반',
            startYear: 2020,
            endYear: 2022,
            trims: [
              { name: '디젤 2.2 프레스티지 9인승', fuelType: '디젤', transmission: '자동' },
              { name: '가솔린 3.5 시그니처', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            name: '더 뉴 카니발 (KA4)',
            powertrain: '일반',
            startYear: 2023,
            endYear: null,
            trims: [
              { name: '디젤 2.2 프레스티지 9인승', fuelType: '디젤', transmission: '자동' },
              { name: '가솔린 3.5 그래비티', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            name: '더 뉴 카니발 하이브리드 (KA4)',
            powertrain: '하이브리드',
            startYear: 2023,
            endYear: null,
            trims: [{ name: '하이브리드 1.6 터보 시그니처 7인승', fuelType: '하이브리드', transmission: '자동' }],
          },
        ],
      },
      {
        name: 'K8',
        models: [
          {
            name: 'K8 (GL3)',
            powertrain: '일반',
            startYear: 2021,
            endYear: 2023,
            trims: [
              { name: '가솔린 2.5 노블레스', fuelType: '가솔린', transmission: '자동' },
              { name: '가솔린 3.5 시그니처', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            name: 'K8 하이브리드 (GL3)',
            powertrain: '하이브리드',
            startYear: 2021,
            endYear: 2023,
            trims: [{ name: '하이브리드 1.6 터보 시그니처', fuelType: '하이브리드', transmission: '자동' }],
          },
          {
            name: '더 뉴 K8 (GL3)',
            powertrain: '일반',
            startYear: 2024,
            endYear: null,
            trims: [
              { name: '가솔린 2.5 노블레스', fuelType: '가솔린', transmission: '자동' },
              { name: '가솔린 3.5 시그니처', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            name: '더 뉴 K8 하이브리드 (GL3)',
            powertrain: '하이브리드',
            startYear: 2024,
            endYear: null,
            trims: [{ name: '하이브리드 1.6 터보 시그니처', fuelType: '하이브리드', transmission: '자동' }],
          },
        ],
      },
    ],
  },
  {
    manufacturer: '제네시스',
    modelGroups: [
      {
        name: 'G80',
        models: [
          {
            name: 'RG3',
            powertrain: '일반',
            startYear: 2020,
            endYear: null,
            trims: [{ name: '가솔린 3.5 터보', fuelType: '가솔린', transmission: '자동' }],
          },
        ],
      },
    ],
  },
  {
    // 웹 검증: WebSearch 예산 소진 후 WebFetch로 위키백과/나무위키 교차 확인.
    manufacturer: 'KG모빌리티',
    nameLegacy: '쌍용',
    modelGroups: [
      {
        name: '토레스',
        models: [
          {
            name: '토레스 (J100)',
            powertrain: '일반',
            startYear: 2022,
            endYear: 2023,
            trims: [
              { name: '가솔린 1.5 터보 T5', fuelType: '가솔린', transmission: '자동' },
              { name: '가솔린 1.5 터보 T7', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            name: '토레스 EVX',
            powertrain: '전기',
            startYear: 2023,
            endYear: 2023,
            trims: [{ name: '전기 E7', fuelType: '전기', transmission: '자동' }],
          },
          {
            name: '더 뉴 토레스 (PF1)',
            powertrain: '일반',
            startYear: 2024,
            endYear: null,
            trims: [
              { name: '가솔린 1.5 터보 T5', fuelType: '가솔린', transmission: '자동' },
              { name: '가솔린 1.5 터보 TL7', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            name: '더 뉴 토레스 EVX',
            powertrain: '전기',
            startYear: 2024,
            endYear: null,
            trims: [{ name: '전기 E7', fuelType: '전기', transmission: '자동' }],
          },
        ],
      },
      {
        name: '렉스턴 스포츠',
        models: [
          {
            name: '렉스턴 스포츠(+칸) (Q200)',
            powertrain: '일반',
            startYear: 2018,
            endYear: 2020,
            trims: [
              { name: '디젤 2.2 와일드', fuelType: '디젤', transmission: '자동' },
              { name: '디젤 2.2 프레스티지', fuelType: '디젤', transmission: '자동' },
            ],
          },
          {
            name: '더 뉴 렉스턴 스포츠 (Q215)',
            powertrain: '일반',
            startYear: 2021,
            endYear: 2021, // 월 불확실: 페이스리프트 주기가 짧아 정확한 종료월 미확인, 연도는 확실
            trims: [
              { name: '디젤 2.2 와일드', fuelType: '디젤', transmission: '자동' },
              { name: '디젤 2.2 노블레스', fuelType: '디젤', transmission: '자동' },
            ],
          },
          {
            name: '뉴 렉스턴 스포츠 (Q250)',
            powertrain: '일반',
            startYear: 2022,
            endYear: 2022, // 월 불확실: 페이스리프트 주기가 짧아 정확한 종료월 미확인, 연도는 확실
            trims: [
              { name: '디젤 2.2 프레스티지', fuelType: '디젤', transmission: '자동' },
              { name: '디젤 2.2 노블레스', fuelType: '디젤', transmission: '자동' },
            ],
          },
          {
            name: '렉스턴 스포츠 칸 쿨멘 (Q260)',
            powertrain: '일반',
            startYear: 2023,
            endYear: null,
            trims: [
              { name: '디젤 2.2 와일드', fuelType: '디젤', transmission: '자동' },
              { name: '디젤 2.2 노블레스', fuelType: '디젤', transmission: '자동' },
            ],
          },
        ],
      },
      {
        name: '코란도',
        models: [
          {
            name: '코란도 C (C200)',
            powertrain: '일반',
            startYear: 2011,
            endYear: 2013,
            trims: [
              { name: '가솔린 2.0 CVS', fuelType: '가솔린', transmission: '자동' },
              { name: '디젤 2.0 CVX', fuelType: '디젤', transmission: '자동' },
            ],
          },
          {
            name: '뉴 코란도 C (C200)',
            powertrain: '일반',
            startYear: 2013,
            endYear: 2019,
            trims: [
              { name: '가솔린 2.0 KX', fuelType: '가솔린', transmission: '자동' },
              { name: '디젤 2.0 RX', fuelType: '디젤', transmission: '자동' },
            ],
          },
          {
            name: '코란도 (C300)',
            powertrain: '일반',
            startYear: 2019,
            endYear: 2025,
            trims: [
              { name: '가솔린 1.5 터보 샤이니', fuelType: '가솔린', transmission: '자동' },
              { name: '디젤 1.6 C7', fuelType: '디젤', transmission: '자동' },
            ],
          },
          {
            name: '코란도 EV (E130)',
            powertrain: '전기',
            startYear: 2024,
            endYear: 2025, // 월 불확실: 정확한 종료월 미확인, 연도는 확실
            trims: [
              { name: '전기 E3', fuelType: '전기', transmission: '자동' },
              { name: '전기 E5', fuelType: '전기', transmission: '자동' },
            ],
          },
        ],
      },
      {
        name: '티볼리',
        models: [
          {
            name: '티볼리',
            powertrain: '일반',
            startYear: 2015,
            endYear: 2017,
            trims: [
              { name: '가솔린 1.6 TX', fuelType: '가솔린', transmission: '자동' },
              { name: '디젤 1.6 VX', fuelType: '디젤', transmission: '자동' },
            ],
          },
          {
            name: '티볼리 아머',
            powertrain: '일반',
            startYear: 2017,
            endYear: 2019,
            trims: [
              { name: '가솔린 1.6 VX', fuelType: '가솔린', transmission: '자동' },
              { name: '가솔린 1.6 기어에디션', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            name: '베리 뉴 티볼리',
            powertrain: '일반',
            startYear: 2019,
            endYear: 2023,
            trims: [
              { name: '가솔린 1.6 V3', fuelType: '가솔린', transmission: '자동' },
              { name: '가솔린 1.6 V5', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            name: '더 뉴 티볼리',
            powertrain: '일반',
            startYear: 2023,
            endYear: null,
            trims: [
              { name: '가솔린 1.6 V1', fuelType: '가솔린', transmission: '자동' },
              { name: '가솔린 1.6 V3', fuelType: '가솔린', transmission: '자동' },
            ],
          },
        ],
      },
    ],
  },
  {
    // 웹 검증: WebSearch 예산 소진 후 WebFetch로 위키백과/나무위키 교차 확인.
    manufacturer: '르노코리아',
    modelGroups: [
      {
        name: 'SM6',
        models: [
          {
            name: 'SM6 (초기형)',
            powertrain: '일반',
            startYear: 2016,
            endYear: 2020,
            trims: [
              { name: '디젤 1.5 SE', fuelType: '디젤', transmission: '자동' },
              { name: '가솔린 터보 1.6 RE', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            name: '더 뉴 SM6',
            powertrain: '일반',
            startYear: 2020,
            endYear: 2025, // 월 불확실: 종료월 출처 상충(3월/11월), 연도는 확실
            trims: [
              { name: '가솔린 터보 1.3 LE', fuelType: '가솔린', transmission: '자동' },
              { name: '가솔린 터보 1.8 Inspire', fuelType: '가솔린', transmission: '자동' },
            ],
          },
        ],
      },
      {
        name: 'QM6',
        models: [
          {
            name: 'QM6 (HZG)',
            powertrain: '일반',
            startYear: 2016,
            endYear: 2019,
            trims: [
              { name: '가솔린 2.0 SE', fuelType: '가솔린', transmission: '자동' },
              { name: '디젤 2.0 LE', fuelType: '디젤', transmission: '자동' },
            ],
          },
          {
            name: '더 뉴 QM6 (1차 F/L)',
            powertrain: '일반',
            startYear: 2019,
            endYear: 2020,
            trims: [
              { name: 'LPe 2.0 LE', fuelType: 'LPG', transmission: '자동' },
              { name: '디젤 1.7 RE', fuelType: '디젤', transmission: '자동' },
            ],
          },
          {
            name: '뉴 QM6 (2차 F/L)',
            powertrain: '일반',
            startYear: 2020,
            endYear: 2023,
            trims: [
              { name: '가솔린 2.0 LE', fuelType: '가솔린', transmission: '자동' },
              { name: 'LPe 2.0 프리미에르', fuelType: 'LPG', transmission: '자동' },
            ],
          },
          {
            name: '더 뉴 QM6 (3차 F/L)',
            powertrain: '일반',
            startYear: 2023,
            endYear: null, // 종료 시점 출처 상충(2025 vs 2026) — 확정 안 돼 진행중으로 처리
            trims: [
              { name: '가솔린 2.0 LE Signature', fuelType: '가솔린', transmission: '자동' },
              { name: 'LPe 2.0 프리미에르', fuelType: 'LPG', transmission: '자동' },
            ],
          },
        ],
      },
      {
        name: 'XM3',
        models: [
          {
            name: 'XM3 (초기형)',
            powertrain: '일반',
            startYear: 2020,
            endYear: 2024,
            trims: [
              { name: '가솔린 터보 1.3 LE', fuelType: '가솔린', transmission: '자동' },
              { name: '가솔린 터보 1.6 RE Signature', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            name: 'XM3 하이브리드 (초기형)',
            powertrain: '하이브리드',
            startYear: 2022,
            endYear: 2024,
            trims: [{ name: 'E-Tech 하이브리드 RE', fuelType: '하이브리드', transmission: '자동' }],
          },
          {
            name: 'XM3 (아르카나)',
            powertrain: '일반',
            startYear: 2024, // 월 불확실: 정확한 출시일 미확인, 연도는 확실
            endYear: null,
            trims: [
              { name: '가솔린 터보 1.3 Evolution', fuelType: '가솔린', transmission: '자동' },
              { name: '가솔린 터보 1.3 Iconic', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            name: 'XM3 하이브리드 (아르카나)',
            powertrain: '하이브리드',
            startYear: 2024,
            endYear: null,
            trims: [{ name: 'E-Tech 하이브리드 Techno', fuelType: '하이브리드', transmission: '자동' }],
          },
        ],
      },
      {
        name: 'SM5',
        models: [
          {
            name: '뉴 SM5 (L43)',
            powertrain: '일반',
            startYear: 2010,
            endYear: 2012,
            trims: [
              { name: '가솔린 2.0 PE', fuelType: '가솔린', transmission: '자동' },
              { name: '디젤 1.5 SE', fuelType: '디젤', transmission: '자동' },
            ],
          },
          {
            name: '뉴 SM5 플래티넘 (L43)',
            powertrain: '일반',
            startYear: 2012,
            endYear: 2015,
            trims: [
              { name: '가솔린 2.0 SE', fuelType: '가솔린', transmission: '자동' },
              { name: '디젤 1.5 LE', fuelType: '디젤', transmission: '자동' },
            ],
          },
          {
            name: 'SM5 노바 (L43)',
            powertrain: '일반',
            startYear: 2015,
            endYear: 2019, // 월 불확실: 생산중단월 출처 상충(6월/12월), 연도는 확실
            trims: [
              { name: '가솔린 2.0 PE Plus', fuelType: '가솔린', transmission: '자동' },
              { name: 'LPG 2.0 SE', fuelType: 'LPG', transmission: '자동' },
            ],
          },
        ],
      },
    ],
  },
];

// 마이그레이션이 시드보다 먼저 도는 순서상, 시드 대상과 같은 이름의 제조사 stub이 findOrCreate로
// 이미 만들어져 있을 수 있다(name_legacy 없음, sort_order=0인 채로). 그 경우 findOrCreate는 기존
// row를 그대로 반환할 뿐 메타데이터를 갱신하지 않으므로, 시드가 의도한 값과 다르면 여기서 채워 넣는다.
//
// name만으로 찾으면 안 된다 — 레거시 매물의 brand가 구 사명(예: '쌍용')이었다면 마이그레이션이
// '쌍용'이라는 별도 제조사 row를 이미 만들어 놨을 수 있고, 시드는 'KG모빌리티'(name_legacy='쌍용')를
// 찾거나 만들려 한다. name과 name_legacy 양쪽으로, 시드의 현재 이름과 구 사명 양쪽을 대조해야
// 같은 실체를 하나의 row로 합칠 수 있다(schema.js의 findOrCreateManufacturerForLegacyCar와 동일한 원리).
function findExistingManufacturer(db, name, nameLegacy) {
  const candidates = [name, nameLegacy].filter(Boolean);
  const clause = candidates.map(() => '(name = ? OR name_legacy = ?)').join(' OR ');
  const params = candidates.flatMap((c) => [c, c]);
  return db.prepare(`SELECT * FROM manufacturers WHERE ${clause}`).get(...params);
}

function upsertManufacturer(db, manufacturerSeed, index) {
  const name = manufacturerSeed.manufacturer;
  const desired = {
    name_legacy: manufacturerSeed.nameLegacy || null,
    is_domestic: 1,
    sort_order: index,
  };

  let manufacturer = findExistingManufacturer(db, name, desired.name_legacy);
  if (!manufacturer) {
    const result = db
      .prepare('INSERT INTO manufacturers (name, name_legacy, is_domestic, sort_order) VALUES (?, ?, ?, ?)')
      .run(name, desired.name_legacy, desired.is_domestic, desired.sort_order);
    manufacturer = db.prepare('SELECT * FROM manufacturers WHERE id = ?').get(result.lastInsertRowid);
  }

  const needsBackfill =
    manufacturer.name !== name ||
    manufacturer.name_legacy !== desired.name_legacy ||
    manufacturer.is_domestic !== desired.is_domestic ||
    manufacturer.sort_order !== desired.sort_order;
  if (needsBackfill) {
    // 마이그레이션이 구 사명(예: '쌍용')으로 만들어 둔 row를 재사용하는 경우, name 자체도
    // 시드가 의도한 정식 명칭(예: 'KG모빌리티')으로 함께 고쳐야 한다 — 안 그러면 name_legacy만
    // 채워진 채 표시명이 구 사명으로 남아버린다.
    db.prepare('UPDATE manufacturers SET name = ?, name_legacy = ?, is_domestic = ?, sort_order = ? WHERE id = ?').run(
      name,
      desired.name_legacy,
      desired.is_domestic,
      desired.sort_order,
      manufacturer.id
    );
    Object.assign(manufacturer, { name, ...desired });
  }

  return manufacturer;
}

function seed(db) {
  CATALOG.forEach((manufacturerSeed, index) => {
    const manufacturer = upsertManufacturer(db, manufacturerSeed, index);

    manufacturerSeed.modelGroups.forEach((groupSeed) => {
      const modelGroup = findOrCreate(
        db,
        'model_groups',
        { manufacturer_id: manufacturer.id, name: groupSeed.name },
        { manufacturer_id: manufacturer.id, name: groupSeed.name }
      );

      groupSeed.models.forEach((modelSeed) => {
        const model = findOrCreate(
          db,
          'models',
          { model_group_id: modelGroup.id, name: modelSeed.name },
          {
            model_group_id: modelGroup.id,
            name: modelSeed.name,
            powertrain: modelSeed.powertrain,
            start_year: modelSeed.startYear,
            end_year: modelSeed.endYear,
          }
        );

        modelSeed.trims.forEach((trimSeed) => {
          findOrCreate(
            db,
            'trims',
            { model_id: model.id, name: trimSeed.name },
            {
              model_id: model.id,
              name: trimSeed.name,
              fuel_type: trimSeed.fuelType,
              transmission: trimSeed.transmission,
            }
          );
        });
      });
    });
  });
}

const FALLBACK_MODEL_NAME = '기본';

// createDb()가 항상 migrateLegacyCarsToTrims를 먼저 돌리는 탓에, 시드가 실행되기 전 legacy 차량은
// 실제 세대가 하나도 없는 상태에서 폴백 '기본' 모델에 영구히 고정된다. seed(db)로 진짜 카탈로그가
// 채워진 뒤 이 함수를 돌려서, '기본'에 남아있는 차량들을 이제 매칭되는 실제 세대(+트림)로 옮기고,
// 더 이상 아무 차량도 참조하지 않게 된 '기본' 모델/트림과, 그 결과 완전히 비어버린
// model_group/manufacturer를 정리한다. 여러 번 실행해도 안전(idempotent)하다 — 이미 옮겨진 차량은
// 더 이상 '기본' 모델을 통해 조회되지 않으므로 재처리 대상에서 자연히 빠진다.
function reconcileLegacyCars(db) {
  const carsOnFallback = db
    .prepare(
      `SELECT cars.id AS car_id, cars.year, cars.fuel_type, cars.transmission,
              models.model_group_id AS model_group_id
       FROM cars
       JOIN trims ON trims.id = cars.trim_id
       JOIN models ON models.id = trims.model_id
       WHERE models.name = ?`
    )
    .all(FALLBACK_MODEL_NAME);

  const touchedModelGroupIds = new Set();

  for (const car of carsOnFallback) {
    touchedModelGroupIds.add(car.model_group_id);

    const realModel = db
      .prepare(
        `SELECT * FROM models
         WHERE model_group_id = ? AND name != ?
           AND start_year <= ? AND (end_year IS NULL OR end_year >= ?)
         ORDER BY start_year DESC
         LIMIT 1`
      )
      .get(car.model_group_id, FALLBACK_MODEL_NAME, car.year, car.year);

    if (!realModel) continue; // 여전히 매칭되는 실제 세대가 없으면 '기본'에 그대로 둔다.

    const trim = findOrCreate(
      db,
      'trims',
      { model_id: realModel.id, fuel_type: car.fuel_type, transmission: car.transmission },
      {
        model_id: realModel.id,
        name: `${car.fuel_type} 기본형`,
        fuel_type: car.fuel_type,
        transmission: car.transmission,
      }
    );

    db.prepare('UPDATE cars SET trim_id = ? WHERE id = ?').run(trim.id, car.car_id);
  }

  const touchedManufacturerIds = new Set();

  for (const modelGroupId of touchedModelGroupIds) {
    const modelGroup = db.prepare('SELECT * FROM model_groups WHERE id = ?').get(modelGroupId);
    if (!modelGroup) continue;
    touchedManufacturerIds.add(modelGroup.manufacturer_id);

    const fallbackModels = db
      .prepare('SELECT * FROM models WHERE model_group_id = ? AND name = ?')
      .all(modelGroupId, FALLBACK_MODEL_NAME);

    for (const model of fallbackModels) {
      const stillReferenced = db
        .prepare(
          `SELECT COUNT(*) AS c FROM cars JOIN trims ON trims.id = cars.trim_id WHERE trims.model_id = ?`
        )
        .get(model.id).c;
      if (stillReferenced === 0) {
        db.prepare('DELETE FROM trims WHERE model_id = ?').run(model.id);
        db.prepare('DELETE FROM models WHERE id = ?').run(model.id);
      }
    }

    const remainingModels = db.prepare('SELECT COUNT(*) AS c FROM models WHERE model_group_id = ?').get(modelGroupId).c;
    if (remainingModels === 0) {
      db.prepare('DELETE FROM model_groups WHERE id = ?').run(modelGroupId);
    }
  }

  for (const manufacturerId of touchedManufacturerIds) {
    const remainingGroups = db
      .prepare('SELECT COUNT(*) AS c FROM model_groups WHERE manufacturer_id = ?')
      .get(manufacturerId).c;
    if (remainingGroups === 0) {
      db.prepare('DELETE FROM manufacturers WHERE id = ?').run(manufacturerId);
    }
  }
}

if (require.main === module) {
  const db = createDb();
  seed(db);
  reconcileLegacyCars(db);
  console.log('카탈로그 시드 데이터 적용 완료');
}

module.exports = { seed, reconcileLegacyCars, CATALOG };
