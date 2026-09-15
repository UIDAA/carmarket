const CURRENT_YEAR = new Date().getFullYear();

// "아반떼(CN7)" -> { groupToken: '아반떼', codeToken: 'CN7' }. 괄호가 없으면 codeToken은 null.
function parseModelName(modelName) {
  if (!modelName) return { groupToken: null, codeToken: null };
  const match = modelName.match(/^([^(（]+?)\s*[(（]([^)）]+)[)）]/);
  if (!match) return { groupToken: modelName.trim(), codeToken: null };
  return { groupToken: match[1].trim(), codeToken: match[2].trim() };
}

function powertrainMatchesFuel(powertrain, fuelType) {
  if (powertrain === '하이브리드') return fuelType === '하이브리드';
  if (powertrain === '전기') return fuelType === '전기';
  return fuelType !== '하이브리드' && fuelType !== '전기';
}

function toCandidate(model, groupById) {
  const group = groupById.get(model.model_group_id);
  return { manufacturerId: group.manufacturer_id, modelGroupId: model.model_group_id, modelId: model.id, label: model.name };
}

function buildStrongResult(model, groupById) {
  const group = groupById.get(model.model_group_id);
  return { confidence: 'strong', manufacturerId: group.manufacturer_id, modelGroupId: model.model_group_id, modelId: model.id };
}

function matchByDate(models, groupById, firstRegisteredDate, fallbackGroup) {
  const year = firstRegisteredDate ? Number(String(firstRegisteredDate).slice(0, 4)) : null;
  if (year) {
    const byYear = models.filter((m) => m.start_year <= year && year <= (m.end_year ?? CURRENT_YEAR));
    if (byYear.length === 1) return buildStrongResult(byYear[0], groupById);
    if (byYear.length > 1) {
      return { confidence: 'ambiguous', candidates: byYear.map((m) => toCandidate(m, groupById)) };
    }
  }
  return { confidence: 'strong', manufacturerId: fallbackGroup.manufacturer_id, modelGroupId: fallbackGroup.id };
}

function matchCatalog(db, { modelName, fuelType, firstRegisteredDate }) {
  const { groupToken, codeToken } = parseModelName(modelName);
  if (!groupToken) return { confidence: 'not_found' };

  const groups = db.prepare('SELECT id, manufacturer_id FROM model_groups WHERE name = ?').all(groupToken);
  if (groups.length === 0) return { confidence: 'not_found' };

  const groupById = new Map(groups.map((g) => [g.id, g]));
  const groupIds = groups.map((g) => g.id);
  const placeholders = groupIds.map(() => '?').join(',');
  const models = db
    .prepare(`SELECT id, model_group_id, name, powertrain, start_year, end_year FROM models WHERE model_group_id IN (${placeholders})`)
    .all(...groupIds);

  if (codeToken) {
    const byCode = models.filter((m) => m.name.includes(codeToken));
    if (byCode.length === 1) return buildStrongResult(byCode[0], groupById);
    if (byCode.length > 1) {
      const byFuel = fuelType ? byCode.filter((m) => powertrainMatchesFuel(m.powertrain, fuelType)) : [];
      if (byFuel.length === 1) return buildStrongResult(byFuel[0], groupById);
      return matchByDate(byCode, groupById, firstRegisteredDate, groups[0]);
    }
  }

  return matchByDate(models, groupById, firstRegisteredDate, groups[0]);
}

// displacementCc(예: 1598) -> "1.6" 같은 배기량 리터 표기가 트림명에 있는 트림만 근사 일치로 본다.
// fuelType도 있으면 trims.fuel_type과 정확히 일치하는 것만 후보로 삼는다.
function matchTrimHint(db, modelId, { displacementCc, fuelType } = {}) {
  if (!modelId || (!displacementCc && !fuelType)) return [];
  const trims = db.prepare('SELECT id, name, fuel_type FROM trims WHERE model_id = ?').all(modelId);
  const liters = displacementCc ? Math.round(displacementCc / 100) / 10 : null;
  return trims
    .filter((t) => {
      if (fuelType && t.fuel_type !== fuelType) return false;
      if (liters === null) return true;
      const match = t.name.match(/(\d\.\d)/);
      if (!match) return false;
      return Math.abs(Number(match[1]) - liters) < 0.05;
    })
    .map((t) => t.id);
}

module.exports = { parseModelName, matchCatalog, matchTrimHint };
