function findOrCreate(db, table, whereCols, insertCols) {
  const whereClause = Object.keys(whereCols)
    .map((col) => `${col} = ?`)
    .join(' AND ');
  const existing = db.prepare(`SELECT * FROM ${table} WHERE ${whereClause}`).get(...Object.values(whereCols));
  if (existing) return existing;

  const cols = Object.keys(insertCols);
  const placeholders = cols.map(() => '?').join(', ');
  const result = db
    .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`)
    .run(...Object.values(insertCols));
  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(result.lastInsertRowid);
}

function seedTrim(db, overrides = {}) {
  const manufacturerName = overrides.manufacturerName || '현대';
  const manufacturer = findOrCreate(
    db,
    'manufacturers',
    { name: manufacturerName },
    { name: manufacturerName, name_legacy: overrides.nameLegacy || null }
  );

  const modelGroupName = overrides.modelGroupName || '아반떼';
  const modelGroup = findOrCreate(
    db,
    'model_groups',
    { manufacturer_id: manufacturer.id, name: modelGroupName },
    { manufacturer_id: manufacturer.id, name: modelGroupName }
  );

  const modelName = overrides.modelName || 'CN7';
  const model = findOrCreate(
    db,
    'models',
    { model_group_id: modelGroup.id, name: modelName },
    {
      model_group_id: modelGroup.id,
      name: modelName,
      powertrain: overrides.powertrain || '일반',
      start_year: overrides.startYear ?? 2020,
      end_year: overrides.endYear ?? null,
    }
  );

  const trimName = overrides.trimName || '가솔린 1.6 스마트';
  const trim = findOrCreate(
    db,
    'trims',
    { model_id: model.id, name: trimName },
    {
      model_id: model.id,
      name: trimName,
      fuel_type: overrides.fuelType || '가솔린',
      transmission: overrides.transmission || '자동',
    }
  );

  return {
    manufacturerId: manufacturer.id,
    modelGroupId: modelGroup.id,
    modelId: model.id,
    trimId: trim.id,
  };
}

module.exports = { seedTrim };
