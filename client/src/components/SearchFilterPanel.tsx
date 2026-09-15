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
import { searchCars } from '../api/cars';
import type { VehiclePickerValue } from './VehiclePicker';

interface Props {
  value: VehiclePickerValue;
  onChange: (next: VehiclePickerValue) => void;
  onSearch: () => void;
}

type ActiveRow = 'manufacturer' | 'model' | 'trim' | 'year' | null;
type ModelStep = 'group' | 'generation';

// 아직 실제 선택 화면을 만들지 않은 행 — 2차 작업에서 채운다. 자리만 잡아두고 비활성 처리.
const PLACEHOLDER_ROWS: { key: string; label: string }[] = [
  { key: 'mileage', label: '주행거리' },
  { key: 'price', label: '가격' },
  { key: 'region', label: '지역' },
  { key: 'fuel', label: '연료' },
  { key: 'transmission', label: '변속기' },
];

function buildSearchQuery(value: VehiclePickerValue) {
  const query: Record<string, string> = { pageSize: '1' };
  if (value.manufacturerId) query.manufacturerId = String(value.manufacturerId);
  if (value.modelGroupId) query.modelGroupId = String(value.modelGroupId);
  if (value.modelId) query.modelId = String(value.modelId);
  if (value.trimId) query.trimId = String(value.trimId);
  if (value.year) {
    query.yearFrom = String(value.year);
    query.yearTo = String(value.year);
  }
  return query;
}

export default function SearchFilterPanel({ value, onChange, onSearch }: Props) {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [modelGroups, setModelGroups] = useState<ModelGroup[]>([]);
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [years, setYears] = useState<YearOption[]>([]);
  const [trims, setTrims] = useState<Trim[]>([]);

  const [activeRow, setActiveRow] = useState<ActiveRow>(null);
  const [modelStep, setModelStep] = useState<ModelStep>('group');

  const [liveTotal, setLiveTotal] = useState<number | null>(null);

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
    listTrims(value.modelId).then(setTrims);
  }, [value.modelId]);

  // 조건이 바뀔 때마다(디바운스) 결과 건수만 미리 받아와 하단 바에 보여준다 — 목록/파셋은 필요 없으니
  // pageSize=1로 요청 크기를 줄인다.
  useEffect(() => {
    const timer = setTimeout(() => {
      searchCars(buildSearchQuery(value)).then((res) => setLiveTotal(res.total));
    }, 300);
    return () => clearTimeout(timer);
  }, [value]);

  function openRow(row: ActiveRow) {
    if (row === 'model') setModelStep(value.modelGroupId ? 'generation' : 'group');
    setActiveRow(row);
  }

  function closeRow() {
    setActiveRow(null);
  }

  function selectManufacturer(id?: number) {
    onChange({ manufacturerId: id });
    closeRow();
  }

  function selectModelGroup(id?: number) {
    if (id === undefined) {
      onChange({ manufacturerId: value.manufacturerId });
      closeRow();
      return;
    }
    onChange({ manufacturerId: value.manufacturerId, modelGroupId: id });
    setModelStep('generation');
  }

  function selectModel(id?: number) {
    onChange({ manufacturerId: value.manufacturerId, modelGroupId: value.modelGroupId, modelId: id });
    closeRow();
  }

  function selectTrim(id?: number) {
    onChange({ ...value, trimId: id });
    closeRow();
  }

  function selectYear(year?: number) {
    onChange({ ...value, year });
    closeRow();
  }

  function clearManufacturer(e: React.MouseEvent) {
    e.stopPropagation();
    onChange({});
  }
  function clearModel(e: React.MouseEvent) {
    e.stopPropagation();
    onChange({ manufacturerId: value.manufacturerId });
  }
  function clearTrim(e: React.MouseEvent) {
    e.stopPropagation();
    onChange({ ...value, trimId: undefined });
  }
  function clearYear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange({ ...value, year: undefined });
  }

  function handleReset() {
    onChange({});
  }

  const selectedManufacturer = manufacturers.find((m) => m.id === value.manufacturerId);
  const selectedModel = models.find((m) => m.id === value.modelId);
  const selectedTrim = trims.find((t) => t.id === value.trimId);

  if (activeRow === 'manufacturer') {
    return (
      <OptionListView title="제조사 선택" onBack={closeRow}>
        <OptionItem label="전체" selected={!value.manufacturerId} onClick={() => selectManufacturer(undefined)} />
        {manufacturers.map((m) => (
          <OptionItem
            key={m.id}
            label={formatManufacturerLabel(m)}
            selected={value.manufacturerId === m.id}
            onClick={() => selectManufacturer(m.id)}
          />
        ))}
      </OptionListView>
    );
  }

  if (activeRow === 'model' && modelStep === 'group') {
    return (
      <OptionListView title="모델 선택" onBack={closeRow}>
        <OptionItem label="전체" selected={!value.modelGroupId} onClick={() => selectModelGroup(undefined)} />
        {modelGroups.map((g) => (
          <OptionItem key={g.id} label={g.name} selected={value.modelGroupId === g.id} onClick={() => selectModelGroup(g.id)} />
        ))}
      </OptionListView>
    );
  }

  if (activeRow === 'model' && modelStep === 'generation') {
    return (
      <OptionListView title="세대 선택" onBack={() => setModelStep('group')}>
        <OptionItem label="전체" selected={!value.modelId} onClick={() => selectModel(undefined)} />
        {models.map((m) => (
          <OptionItem
            key={m.id}
            label={m.name}
            sub={`${m.startYear}년~${m.endYear ? `${m.endYear}년` : '현재'}`}
            selected={value.modelId === m.id}
            onClick={() => selectModel(m.id)}
          />
        ))}
      </OptionListView>
    );
  }

  if (activeRow === 'trim') {
    return (
      <OptionListView title="등급 선택" onBack={closeRow}>
        <OptionItem label="전체" selected={!value.trimId} onClick={() => selectTrim(undefined)} />
        {trims.map((t) => (
          <OptionItem key={t.id} label={t.name} selected={value.trimId === t.id} onClick={() => selectTrim(t.id)} />
        ))}
      </OptionListView>
    );
  }

  if (activeRow === 'year') {
    return (
      <OptionListView title="연식 선택" onBack={closeRow}>
        <OptionItem label="전체" selected={!value.year} onClick={() => selectYear(undefined)} />
        {years.map((y) => (
          <OptionItem key={y.year} label={`${y.year}년`} selected={value.year === y.year} onClick={() => selectYear(y.year)} />
        ))}
      </OptionListView>
    );
  }

  return (
    <div>
      <div className="filter-panel">
        <FilterRow
          label="제조사"
          value={selectedManufacturer ? formatManufacturerLabel(selectedManufacturer) : undefined}
          onClick={() => openRow('manufacturer')}
          onClear={value.manufacturerId ? clearManufacturer : undefined}
        />
        <FilterRow
          label="모델"
          value={selectedModel?.name}
          sub={selectedModel ? `${selectedModel.startYear}년~${selectedModel.endYear ? `${selectedModel.endYear}년` : '현재'}` : undefined}
          onClick={() => openRow('model')}
          onClear={value.modelGroupId ? clearModel : undefined}
        />
        <FilterRow
          label="등급"
          value={selectedTrim?.name}
          disabled={!value.modelId}
          onClick={() => openRow('trim')}
          onClear={value.trimId ? clearTrim : undefined}
        />

        <div className="filter-section-divider" />

        <FilterRow
          label="연식"
          value={value.year ? `${value.year}년식` : undefined}
          disabled={!value.modelId}
          onClick={() => openRow('year')}
          onClear={value.year ? clearYear : undefined}
        />
        {PLACEHOLDER_ROWS.slice(0, 2).map((row) => (
          <FilterRow key={row.key} label={row.label} value="준비 중" disabled noChevron />
        ))}

        <div className="filter-section-divider" />

        {PLACEHOLDER_ROWS.slice(2).map((row) => (
          <FilterRow key={row.key} label={row.label} value="준비 중" disabled noChevron />
        ))}
      </div>

      <div className="filter-bottom-bar">
        <div className="filter-bottom-bar-inner">
          <button className="btn-ghost" onClick={handleReset}>
            전체 초기화
          </button>
          <button className="btn-primary" onClick={onSearch}>
            검색{liveTotal !== null ? `(${liveTotal}대)` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

interface FilterRowProps {
  label: string;
  value?: string;
  sub?: string;
  disabled?: boolean;
  noChevron?: boolean;
  onClick?: () => void;
  onClear?: (e: React.MouseEvent) => void;
}

function FilterRow({ label, value, sub, disabled, noChevron, onClick, onClear }: FilterRowProps) {
  // 해제(✕) 버튼이 있는 행은 실제 <button>을 중첩할 수 없어(무효한 HTML + 접근성 문제) 바깥
  // 요소를 div+role="button"으로 두고, ✕만 진짜 <button>으로 둔다.
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      className={`filter-row${disabled ? ' filter-row--disabled' : ''}`}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(e) => {
        if (disabled || !onClick) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <span className="filter-row-label">{label}</span>
      <span className="filter-row-value">
        <span className="filter-row-value-main">{value ?? '전체'}</span>
        {sub && <span className="filter-row-value-sub">({sub})</span>}
      </span>
      {onClear && (
        <button
          type="button"
          className="filter-row-clear"
          onClick={(e) => {
            e.stopPropagation();
            onClear(e);
          }}
          aria-label={`${label} 조건 해제`}
        >
          ✕
        </button>
      )}
      {!noChevron && <span className="filter-row-chevron">›</span>}
    </div>
  );
}

function OptionListView({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="filter-panel">
      <div className="filter-subview-header">
        <button className="filter-subview-back" onClick={onBack} aria-label="뒤로">
          ‹
        </button>
        {title}
      </div>
      <div className="filter-option-list">{children}</div>
    </div>
  );
}

function OptionItem({
  label,
  sub,
  selected,
  onClick,
}: {
  label: string;
  sub?: string;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`filter-option-item${selected ? ' filter-option-item--selected' : ''}`}
      onClick={onClick}
    >
      {label}
      {sub && <span className="filter-option-sub">({sub})</span>}
    </button>
  );
}
