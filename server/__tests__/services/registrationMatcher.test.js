const { createDb } = require('../../db/schema');
const { seedTrim } = require('../helpers/catalogFixtures');
const { parseModelName, matchCatalog, matchTrimHint } = require('../../services/registrationMatcher');

describe('parseModelName', () => {
  it('괄호 안 세대코드를 분리한다', () => {
    expect(parseModelName('아반떼(CN7)')).toEqual({ groupToken: '아반떼', codeToken: 'CN7' });
  });
  it('괄호 앞뒤 공백이 있어도 분리한다', () => {
    expect(parseModelName('아반떼 (CN7)')).toEqual({ groupToken: '아반떼', codeToken: 'CN7' });
  });
  it('괄호가 없으면 codeToken은 null', () => {
    expect(parseModelName('아반떼')).toEqual({ groupToken: '아반떼', codeToken: null });
  });
  it('null 입력은 둘 다 null', () => {
    expect(parseModelName(null)).toEqual({ groupToken: null, codeToken: null });
  });
});

describe('matchCatalog', () => {
  it('세대코드가 유일하게 일치하면 strong + modelId까지 확정', () => {
    const db = createDb(':memory:');
    const { manufacturerId, modelGroupId, modelId } = seedTrim(db, {
      modelGroupName: '아반떼',
      modelName: '아반떼 (CN7)',
    });
    const result = matchCatalog(db, { modelName: '아반떼(CN7)', fuelType: '가솔린', firstRegisteredDate: '2021-01-01' });
    expect(result).toEqual({ confidence: 'strong', manufacturerId, modelGroupId, modelId });
  });

  it('모델그룹 자체를 못 찾으면 not_found', () => {
    const db = createDb(':memory:');
    seedTrim(db);
    const result = matchCatalog(db, { modelName: '없는모델(XX9)', fuelType: null, firstRegisteredDate: null });
    expect(result).toEqual({ confidence: 'not_found' });
  });

  it('세대코드가 없고 날짜로 유일하게 좁혀지면 strong', () => {
    const db = createDb(':memory:');
    seedTrim(db, { modelGroupName: '아반떼', modelName: '아반떼 (AD)', startYear: 2015, endYear: 2019 });
    const { modelId } = seedTrim(db, { modelGroupName: '아반떼', modelName: '아반떼 (CN7)', startYear: 2020, endYear: null });
    const result = matchCatalog(db, { modelName: '아반떼', fuelType: null, firstRegisteredDate: '2021-05-01' });
    expect(result.confidence).toBe('strong');
    expect(result.modelId).toBe(modelId);
  });

  it('세대코드도 날짜도 없으면 모델그룹까지만 strong으로 채운다(세대는 비움)', () => {
    const db = createDb(':memory:');
    const { manufacturerId, modelGroupId } = seedTrim(db, {
      modelGroupName: '아반떼',
      modelName: '아반떼 (AD)',
      startYear: 2015,
      endYear: 2019,
    });
    seedTrim(db, { modelGroupName: '아반떼', modelName: '아반떼 (CN7)', startYear: 2020, endYear: null });
    const result = matchCatalog(db, { modelName: '아반떼', fuelType: null, firstRegisteredDate: null });
    expect(result).toEqual({ confidence: 'strong', manufacturerId, modelGroupId });
  });

  it('같은 세대코드에 파워트레인 형제가 있고 연료로도 날짜로도 못 좁히면 ambiguous', () => {
    const db = createDb(':memory:');
    const gasoline = seedTrim(db, { modelGroupName: '그랜저', modelName: '그랜저 (GN7)', startYear: 2022, endYear: 2025 });
    const hybrid = seedTrim(db, {
      modelGroupName: '그랜저',
      modelName: '그랜저 하이브리드 (GN7)',
      powertrain: '하이브리드',
      fuelType: '하이브리드',
      startYear: 2022,
      endYear: 2025,
      trimName: '하이브리드 트림',
    });
    const result = matchCatalog(db, { modelName: '그랜저(GN7)', fuelType: null, firstRegisteredDate: '2023-01-01' });
    expect(result.confidence).toBe('ambiguous');
    expect(result.candidates.map((c) => c.modelId).sort()).toEqual([gasoline.modelId, hybrid.modelId].sort());
  });

  it('같은 세대코드에 파워트레인 형제가 있으면 연료로 좁힌다', () => {
    const db = createDb(':memory:');
    seedTrim(db, { modelGroupName: '그랜저', modelName: '그랜저 (GN7)', startYear: 2022, endYear: 2025 });
    const hybrid = seedTrim(db, {
      modelGroupName: '그랜저',
      modelName: '그랜저 하이브리드 (GN7)',
      powertrain: '하이브리드',
      fuelType: '하이브리드',
      startYear: 2022,
      endYear: 2025,
      trimName: '하이브리드 트림',
    });
    const result = matchCatalog(db, { modelName: '그랜저(GN7)', fuelType: '하이브리드', firstRegisteredDate: null });
    expect(result.confidence).toBe('strong');
    expect(result.modelId).toBe(hybrid.modelId);
  });
});

describe('matchTrimHint', () => {
  it('배기량과 연료가 둘 다 근사 일치하는 트림만 돌려준다', () => {
    const db = createDb(':memory:');
    const gasoline = seedTrim(db, { trimName: '가솔린 1.6 스마트', fuelType: '가솔린' });
    // 같은 세대 안에 연료/배기량이 다른 트림을 하나 더 만든다.
    db.prepare('INSERT INTO trims (model_id, name, fuel_type, transmission) VALUES (?, ?, ?, ?)').run(
      gasoline.modelId,
      '디젤 2.0 프리미엄',
      '디젤',
      '자동'
    );

    const ids = matchTrimHint(db, gasoline.modelId, { displacementCc: 1598, fuelType: '가솔린' });
    expect(ids).toEqual([gasoline.trimId]);
  });

  it('displacementCc와 fuelType이 둘 다 없으면 빈 배열', () => {
    const db = createDb(':memory:');
    const { modelId } = seedTrim(db);
    expect(matchTrimHint(db, modelId, {})).toEqual([]);
  });

  it('modelId가 없으면 빈 배열', () => {
    const db = createDb(':memory:');
    expect(matchTrimHint(db, undefined, { displacementCc: 1600 })).toEqual([]);
  });
});
