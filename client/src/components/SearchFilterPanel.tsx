import { useEffect, useRef, useState } from 'react';
import {
  type Manufacturer,
  type ModelGroup,
  type CatalogModel,
  type Trim,
  listManufacturers,
  listModelGroups,
  listModels,
  listTrims,
  formatManufacturerLabel,
} from '../api/catalog';
import { searchCars, type Facets } from '../api/cars';

export interface SearchFilterValue {
  manufacturerId?: number;
  modelGroupId?: number;
  modelId?: number;
  trimId?: number;
  yearFrom?: number;
  yearTo?: number;
  mileageMin?: number;
  mileageMax?: number;
  priceMin?: number;
  priceMax?: number;
  region?: string;
  fuel?: string;
  transmission?: string;
}

interface Props {
  value: SearchFilterValue;
  onChange: (next: SearchFilterValue) => void;
  onSearch: () => void;
}

type ActiveRow =
  | 'manufacturer'
  | 'model'
  | 'trim'
  | 'year'
  | 'mileage'
  | 'price'
  | 'region'
  | 'fuel'
  | 'transmission'
  | null;
type ModelStep = 'group' | 'generation';
type YearStep = 'min' | 'max';

const CURRENT_YEAR = new Date().getFullYear();
const FALLBACK_MIN_YEAR = 1990;

const MILEAGE_MIN = 0;
const MILEAGE_MAX = 400000; // "40만km 이상"
const MILEAGE_STEP = 10000;

const PRICE_MIN = 0;
const PRICE_MAX = 100000000; // "1억 이상"
const PRICE_STEP = 1000000;

function buildSearchQuery(value: SearchFilterValue) {
  const query: Record<string, string> = { pageSize: '1' };
  if (value.manufacturerId) query.manufacturerId = String(value.manufacturerId);
  if (value.modelGroupId) query.modelGroupId = String(value.modelGroupId);
  if (value.modelId) query.modelId = String(value.modelId);
  if (value.trimId) query.trimId = String(value.trimId);
  if (value.yearFrom) query.yearFrom = String(value.yearFrom);
  if (value.yearTo) query.yearTo = String(value.yearTo);
  if (value.mileageMin !== undefined) query.mileageMin = String(value.mileageMin);
  if (value.mileageMax !== undefined) query.mileageMax = String(value.mileageMax);
  if (value.priceMin !== undefined) query.priceMin = String(value.priceMin);
  if (value.priceMax !== undefined) query.priceMax = String(value.priceMax);
  if (value.region) query.region = value.region;
  if (value.fuel) query.fuel = value.fuel;
  if (value.transmission) query.transmission = value.transmission;
  return query;
}

function range(from: number, to: number) {
  const years: number[] = [];
  for (let y = to; y >= from; y--) years.push(y);
  return years;
}

function formatYearRange(yearFrom?: number, yearTo?: number) {
  if (!yearFrom && !yearTo) return undefined;
  if (!yearFrom) return `~${yearTo}년`;
  if (!yearTo) return `${yearFrom}년~`;
  return `${yearFrom}~${yearTo}년`;
}

function formatMileage(km: number) {
  return `${(km / 10000).toFixed(0)}만km`;
}
function formatPrice(price: number) {
  return `${Math.round(price / 10000).toLocaleString()}만원`;
}

// low/high가 각각 min/max(전 구간 끝)에 있으면 "전체"/"OO 이상"으로, 그 외엔 실제 범위로 표시한다.
function formatBoundedRange(
  low: number,
  high: number,
  min: number,
  max: number,
  format: (n: number) => string
) {
  if (low === min && high === max) return undefined;
  if (low === min) return `~ ${format(high)}`;
  if (high === max) return `${format(low)} 이상`;
  return `${format(low)} ~ ${format(high)}`;
}

export default function SearchFilterPanel({ value, onChange, onSearch }: Props) {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [modelGroups, setModelGroups] = useState<ModelGroup[]>([]);
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [trims, setTrims] = useState<Trim[]>([]);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [liveTotal, setLiveTotal] = useState<number | null>(null);

  const [activeRow, setActiveRow] = useState<ActiveRow>(null);
  const [modelStep, setModelStep] = useState<ModelStep>('group');
  const [yearStep, setYearStep] = useState<YearStep>('min');

  const [draftMileageLow, setDraftMileageLow] = useState(MILEAGE_MIN);
  const [draftMileageHigh, setDraftMileageHigh] = useState(MILEAGE_MAX);
  const [draftPriceLow, setDraftPriceLow] = useState(PRICE_MIN);
  const [draftPriceHigh, setDraftPriceHigh] = useState(PRICE_MAX);
  const [draftChoice, setDraftChoice] = useState<string | undefined>(undefined); // 지역/연료/변속기 공용

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
    if (!value.modelId) return setTrims([]);
    listTrims(value.modelId).then(setTrims);
  }, [value.modelId]);

  // 조건이 바뀔 때마다(첫 요청은 즉시, 이후엔 디바운스) 결과 건수 + 자기제외 파셋을 미리 받아온다.
  // 목록은 필요 없으니 pageSize=1로 요청 크기를 줄인다.
  const isFirstFetch = useRef(true);
  useEffect(() => {
    const delay = isFirstFetch.current ? 0 : 300;
    isFirstFetch.current = false;
    const timer = setTimeout(() => {
      searchCars(buildSearchQuery(value)).then((res) => {
        setLiveTotal(res.total);
        setFacets(res.facets);
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [value]);

  function openRow(row: ActiveRow) {
    if (row === 'model') setModelStep(value.modelGroupId ? 'generation' : 'group');
    if (row === 'year') setYearStep('min');
    if (row === 'mileage') {
      setDraftMileageLow(value.mileageMin ?? MILEAGE_MIN);
      setDraftMileageHigh(value.mileageMax ?? MILEAGE_MAX);
    }
    if (row === 'price') {
      setDraftPriceLow(value.priceMin ?? PRICE_MIN);
      setDraftPriceHigh(value.priceMax ?? PRICE_MAX);
    }
    if (row === 'region') setDraftChoice(value.region);
    if (row === 'fuel') setDraftChoice(value.fuel);
    if (row === 'transmission') setDraftChoice(value.transmission);
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

  function selectYearMin(year?: number) {
    // 이미 골라둔 최대 연식이 새 최소 연식보다 작아지면(역전) 함께 지운다.
    const nextYearTo = value.yearTo !== undefined && year !== undefined && value.yearTo < year ? undefined : value.yearTo;
    onChange({ ...value, yearFrom: year, yearTo: nextYearTo });
    setYearStep('max');
  }

  function selectYearMax(year?: number) {
    onChange({ ...value, yearTo: year });
    closeRow();
  }

  function confirmMileage() {
    onChange({
      ...value,
      mileageMin: draftMileageLow === MILEAGE_MIN ? undefined : draftMileageLow,
      mileageMax: draftMileageHigh === MILEAGE_MAX ? undefined : draftMileageHigh,
    });
    closeRow();
  }

  function confirmPrice() {
    onChange({
      ...value,
      priceMin: draftPriceLow === PRICE_MIN ? undefined : draftPriceLow,
      priceMax: draftPriceHigh === PRICE_MAX ? undefined : draftPriceHigh,
    });
    closeRow();
  }

  function confirmChoice() {
    if (activeRow === 'region') onChange({ ...value, region: draftChoice });
    if (activeRow === 'fuel') onChange({ ...value, fuel: draftChoice });
    if (activeRow === 'transmission') onChange({ ...value, transmission: draftChoice });
    closeRow();
  }

  function stop(fn: (e: React.MouseEvent) => void) {
    return (e: React.MouseEvent) => {
      e.stopPropagation();
      fn(e);
    };
  }

  const clearManufacturer = stop(() => onChange({}));
  const clearModel = stop(() => onChange({ manufacturerId: value.manufacturerId }));
  const clearTrim = stop(() => onChange({ ...value, trimId: undefined }));
  const clearYear = stop(() => onChange({ ...value, yearFrom: undefined, yearTo: undefined }));
  const clearMileage = stop(() => onChange({ ...value, mileageMin: undefined, mileageMax: undefined }));
  const clearPrice = stop(() => onChange({ ...value, priceMin: undefined, priceMax: undefined }));
  const clearRegion = stop(() => onChange({ ...value, region: undefined }));
  const clearFuel = stop(() => onChange({ ...value, fuel: undefined }));
  const clearTransmission = stop(() => onChange({ ...value, transmission: undefined }));

  function handleReset() {
    onChange({});
  }

  const selectedManufacturer = manufacturers.find((m) => m.id === value.manufacturerId);
  const selectedModel = models.find((m) => m.id === value.modelId);
  const selectedTrim = trims.find((t) => t.id === value.trimId);

  const yearMin = selectedModel?.startYear ?? FALLBACK_MIN_YEAR;
  const yearMax = selectedModel?.endYear ?? CURRENT_YEAR;
  const yearMinOptions = range(yearMin, yearMax);
  const yearMaxOptions = range(value.yearFrom ?? yearMin, yearMax);

  const fuelOptions = facets?.fuel ?? [];
  const transmissionOptions = facets?.transmission ?? [];
  const regionOptions = facets?.region ?? [];
  const fuelTotal = fuelOptions.reduce((sum, o) => sum + o.count, 0);
  const transmissionTotal = transmissionOptions.reduce((sum, o) => sum + o.count, 0);
  const regionTotal = regionOptions.reduce((sum, o) => sum + o.count, 0);

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

  if (activeRow === 'year' && yearStep === 'min') {
    return (
      <OptionListView title="최소 연식 선택" onBack={closeRow}>
        <OptionItem label="전체" selected={!value.yearFrom} onClick={() => selectYearMin(undefined)} />
        {yearMinOptions.map((y) => (
          <OptionItem key={y} label={`${y}년`} selected={value.yearFrom === y} onClick={() => selectYearMin(y)} />
        ))}
      </OptionListView>
    );
  }

  if (activeRow === 'year' && yearStep === 'max') {
    return (
      <OptionListView title="최대 연식 선택" onBack={() => setYearStep('min')}>
        <OptionItem label="전체" selected={!value.yearTo} onClick={() => selectYearMax(undefined)} />
        {yearMaxOptions.map((y) => (
          <OptionItem key={y} label={`${y}년`} selected={value.yearTo === y} onClick={() => selectYearMax(y)} />
        ))}
      </OptionListView>
    );
  }

  if (activeRow === 'mileage') {
    return (
      <div className="filter-panel">
        <div className="filter-subview-header">
          <button className="filter-subview-back" onClick={closeRow} aria-label="뒤로">
            ‹
          </button>
          주행거리 선택
        </div>
        <div className="filter-slider-body">
          <div className="filter-slider-value">
            {formatBoundedRange(draftMileageLow, draftMileageHigh, MILEAGE_MIN, MILEAGE_MAX, formatMileage) ?? '전체'}
          </div>
          <RangeSlider
            min={MILEAGE_MIN}
            max={MILEAGE_MAX}
            step={MILEAGE_STEP}
            low={draftMileageLow}
            high={draftMileageHigh}
            onLowChange={setDraftMileageLow}
            onHighChange={setDraftMileageHigh}
          />
        </div>
        <div className="filter-bottom-bar">
          <div className="filter-bottom-bar-inner">
            <button className="btn-primary" onClick={confirmMileage}>
              확인
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activeRow === 'price') {
    return (
      <div className="filter-panel">
        <div className="filter-subview-header">
          <button className="filter-subview-back" onClick={closeRow} aria-label="뒤로">
            ‹
          </button>
          가격 선택
        </div>
        <div className="filter-slider-body">
          <div className="filter-slider-value">
            {formatBoundedRange(draftPriceLow, draftPriceHigh, PRICE_MIN, PRICE_MAX, formatPrice) ?? '전체'}
          </div>
          <RangeSlider
            min={PRICE_MIN}
            max={PRICE_MAX}
            step={PRICE_STEP}
            low={draftPriceLow}
            high={draftPriceHigh}
            onLowChange={setDraftPriceLow}
            onHighChange={setDraftPriceHigh}
          />
        </div>
        <div className="filter-bottom-bar">
          <div className="filter-bottom-bar-inner">
            <button className="btn-primary" onClick={confirmPrice}>
              확인
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activeRow === 'region' || activeRow === 'fuel' || activeRow === 'transmission') {
    const titleByRow = { region: '지역 선택', fuel: '연료 선택', transmission: '변속기 선택' } as const;
    const optionsByRow = { region: regionOptions, fuel: fuelOptions, transmission: transmissionOptions } as const;
    const totalByRow = { region: regionTotal, fuel: fuelTotal, transmission: transmissionTotal } as const;
    const options = optionsByRow[activeRow];
    return (
      <div className="filter-panel">
        <div className="filter-subview-header">
          <button className="filter-subview-back" onClick={closeRow} aria-label="뒤로">
            ‹
          </button>
          {titleByRow[activeRow]}
        </div>
        {facets === null ? (
          <p style={{ padding: 18, color: 'var(--text-soft)', fontSize: 13 }}>불러오는 중...</p>
        ) : (
          <div className="filter-option-list">
            <CheckOptionItem
              label="전체"
              count={totalByRow[activeRow]}
              selected={!draftChoice}
              onClick={() => setDraftChoice(undefined)}
            />
            {options.map((o) => (
              <CheckOptionItem
                key={o.value}
                label={o.value}
                count={o.count}
                selected={draftChoice === o.value}
                onClick={() => setDraftChoice(o.value)}
              />
            ))}
          </div>
        )}
        <div className="filter-bottom-bar">
          <div className="filter-bottom-bar-inner">
            <button className="btn-primary" onClick={confirmChoice}>
              확인
            </button>
          </div>
        </div>
      </div>
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
          value={formatYearRange(value.yearFrom, value.yearTo)}
          onClick={() => openRow('year')}
          onClear={value.yearFrom || value.yearTo ? clearYear : undefined}
        />
        <FilterRow
          label="주행거리"
          value={formatBoundedRange(value.mileageMin ?? MILEAGE_MIN, value.mileageMax ?? MILEAGE_MAX, MILEAGE_MIN, MILEAGE_MAX, formatMileage)}
          onClick={() => openRow('mileage')}
          onClear={value.mileageMin !== undefined || value.mileageMax !== undefined ? clearMileage : undefined}
        />
        <FilterRow
          label="가격"
          value={formatBoundedRange(value.priceMin ?? PRICE_MIN, value.priceMax ?? PRICE_MAX, PRICE_MIN, PRICE_MAX, formatPrice)}
          onClick={() => openRow('price')}
          onClear={value.priceMin !== undefined || value.priceMax !== undefined ? clearPrice : undefined}
        />

        <div className="filter-section-divider" />

        <FilterRow
          label="지역"
          value={value.region}
          onClick={() => openRow('region')}
          onClear={value.region ? clearRegion : undefined}
        />
        <FilterRow label="연료" value={value.fuel} onClick={() => openRow('fuel')} onClear={value.fuel ? clearFuel : undefined} />
        <FilterRow
          label="변속기"
          value={value.transmission}
          onClick={() => openRow('transmission')}
          onClear={value.transmission ? clearTransmission : undefined}
        />
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
  onClick?: () => void;
  onClear?: (e: React.MouseEvent) => void;
}

function FilterRow({ label, value, sub, disabled, onClick, onClear }: FilterRowProps) {
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
        <button type="button" className="filter-row-clear" onClick={onClear} aria-label={`${label} 조건 해제`}>
          ✕
        </button>
      )}
      <span className="filter-row-chevron">›</span>
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

function CheckOptionItem({
  label,
  count,
  selected,
  onClick,
}: {
  label: string;
  count: number;
  selected?: boolean;
  onClick: () => void;
}) {
  const zero = count === 0;
  return (
    <button type="button" className={`filter-check-item${zero ? ' filter-check-item--zero' : ''}`} onClick={onClick}>
      <span className={`filter-checkbox${selected ? ' filter-checkbox--checked' : ''}`}>{selected ? '✓' : ''}</span>
      <span className="filter-check-label">{label}</span>
      <span className="filter-check-count">{count.toLocaleString()}</span>
    </button>
  );
}

function RangeSlider({
  min,
  max,
  step,
  low,
  high,
  onLowChange,
  onHighChange,
}: {
  min: number;
  max: number;
  step: number;
  low: number;
  high: number;
  onLowChange: (n: number) => void;
  onHighChange: (n: number) => void;
}) {
  const lowPct = ((low - min) / (max - min)) * 100;
  const highPct = ((high - min) / (max - min)) * 100;
  const lowOnTop = low > min + (max - min) / 2;

  return (
    <div className="range-slider">
      <div className="range-slider-track" />
      <div className="range-slider-fill" style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%` }} />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={low}
        className="range-slider-input"
        style={{ zIndex: lowOnTop ? 4 : 2 }}
        onChange={(e) => onLowChange(Math.min(Number(e.target.value), high))}
        aria-label="최소값"
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={high}
        className="range-slider-input"
        style={{ zIndex: lowOnTop ? 2 : 4 }}
        onChange={(e) => onHighChange(Math.max(Number(e.target.value), low))}
        aria-label="최대값"
      />
    </div>
  );
}
