import { useEffect, useState } from 'react';
import {
  type Manufacturer,
  type ModelGroup,
  type CatalogModel,
  type YearOption,
  type Trim,
  listManufacturers,
  listModelGroups,
  listModels,
  listYears,
  listTrims,
  formatManufacturerLabel,
} from '../api/catalog';

export interface VehiclePickerValue {
  manufacturerId?: number;
  modelGroupId?: number;
  modelId?: number;
  year?: number; // 트림 카운트를 특정 연식(first_registered_year)으로 좁혀 보기 위한 임시 값. 폼 제출 필드가 아니다.
  trimId?: number;
}

interface Props {
  value: VehiclePickerValue;
  onChange: (next: VehiclePickerValue) => void;
  hideEmpty?: boolean;
  highlightTrimIds?: number[];
}

export default function VehiclePicker({ value, onChange, hideEmpty = false, highlightTrimIds }: Props) {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [modelGroups, setModelGroups] = useState<ModelGroup[]>([]);
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [years, setYears] = useState<YearOption[]>([]);
  const [trims, setTrims] = useState<Trim[]>([]);

  useEffect(() => {
    listManufacturers().then(setManufacturers);
  }, []);

  useEffect(() => {
    if (!value.manufacturerId) return setModelGroups([]);
    listModelGroups(value.manufacturerId).then(setModelGroups);
  }, [value.manufacturerId]);

  useEffect(() => {
    if (!value.modelGroupId) return setModels([]);
    listModels(value.modelGroupId).then(setModels);
  }, [value.modelGroupId]);

  useEffect(() => {
    if (!value.modelId) return setYears([]);
    listYears(value.modelId).then(setYears);
  }, [value.modelId]);

  useEffect(() => {
    if (!value.modelId) return setTrims([]);
    listTrims(value.modelId, value.year).then(setTrims);
  }, [value.modelId, value.year]);

  function visible<T extends { count: number }>(items: T[]) {
    return hideEmpty ? items.filter((item) => item.count > 0) : items;
  }

  return (
    <div className="vehicle-picker">
      <select
        className="input"
        value={value.manufacturerId ?? ''}
        onChange={(e) => onChange({ manufacturerId: e.target.value ? Number(e.target.value) : undefined })}
      >
        <option value="">브랜드 선택</option>
        {visible(manufacturers).map((m) => (
          <option key={m.id} value={m.id}>
            {formatManufacturerLabel(m)} ({m.count})
          </option>
        ))}
      </select>

      <select
        className="input"
        value={value.modelGroupId ?? ''}
        disabled={!value.manufacturerId}
        onChange={(e) =>
          onChange({
            manufacturerId: value.manufacturerId,
            modelGroupId: e.target.value ? Number(e.target.value) : undefined,
          })
        }
      >
        <option value="">모델 선택</option>
        {visible(modelGroups).map((g) => (
          <option key={g.id} value={g.id}>
            {g.name} ({g.count})
          </option>
        ))}
      </select>

      <select
        className="input"
        value={value.modelId ?? ''}
        disabled={!value.modelGroupId}
        onChange={(e) =>
          onChange({
            manufacturerId: value.manufacturerId,
            modelGroupId: value.modelGroupId,
            modelId: e.target.value ? Number(e.target.value) : undefined,
          })
        }
      >
        <option value="">세대 선택</option>
        {visible(models).map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} ({m.startYear}~{m.endYear ?? ''}) ({m.count})
          </option>
        ))}
      </select>

      <select
        className="input"
        value={value.year ?? ''}
        disabled={!value.modelId}
        onChange={(e) =>
          onChange({
            manufacturerId: value.manufacturerId,
            modelGroupId: value.modelGroupId,
            modelId: value.modelId,
            year: e.target.value ? Number(e.target.value) : undefined,
          })
        }
      >
        <option value="">연식 선택</option>
        {visible(years).map((y) => (
          <option key={y.year} value={y.year}>
            {y.year}년 ({y.count})
          </option>
        ))}
      </select>

      <select
        className="input"
        value={value.trimId ?? ''}
        disabled={!value.modelId}
        onChange={(e) => onChange({ ...value, trimId: e.target.value ? Number(e.target.value) : undefined })}
      >
        <option value="">트림 선택</option>
        {visible(trims).map((t) => (
          <option key={t.id} value={t.id}>
            {highlightTrimIds?.includes(t.id) ? '⭐ ' : ''}
            {t.name} ({t.count})
          </option>
        ))}
      </select>
    </div>
  );
}
