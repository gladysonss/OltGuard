import { useCallback, useEffect, useState } from 'react';
import {
  api,
  type Alarm,
  type AlarmCondition,
  type AlarmSeverity,
  type AlarmSummary,
  type Olt,
  type OltGuardEvent,
  type OltWorstSeverity,
} from '../api';
import { SEVERITY_COLOR_VAR, SEVERITY_LABEL, SEVERITY_ORDER } from '../severity';

type View = 'alarms' | 'events';
type AlarmStatusFilter = 'active' | 'inactive' | 'all';

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
const DEFAULT_PAGE_SIZE = 50;

const ALARM_STATUS_CONDITION: Record<AlarmStatusFilter, AlarmCondition | undefined> = {
  active: 'ACTIVE',
  inactive: 'CLEARED',
  all: undefined,
};

const NO_CITY_LABEL = 'Sem cidade';

function groupOltsByCity(olts: Olt[]): { city: string; olts: Olt[] }[] {
  const groups = new Map<string, Olt[]>();
  for (const olt of olts) {
    const city = olt.city?.name?.trim() || NO_CITY_LABEL;
    if (!groups.has(city)) groups.set(city, []);
    groups.get(city)!.push(olt);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => {
      if (a === NO_CITY_LABEL) return 1;
      if (b === NO_CITY_LABEL) return -1;
      return a.localeCompare(b);
    })
    .map(([city, cityOlts]) => ({ city, olts: cityOlts }));
}

function oltDotColor(oltWorstSeverity: OltWorstSeverity, oltId: string): string {
  const worst = oltWorstSeverity[oltId];
  return worst ? `var(${SEVERITY_COLOR_VAR[worst]})` : 'var(--ok)';
}

const ALL_SEVERITIES: AlarmSeverity[] = ['CRITICAL', 'MAJOR', 'MINOR', 'WARNING', 'INFO'];

interface AlarmFilters {
  severity: AlarmSeverity[];
  slotNo: string;
  portNo: string;
  logicalPortNo: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: AlarmFilters = { severity: [], slotNo: '', portNo: '', logicalPortNo: '', from: '', to: '' };

function hasActiveFilters(f: AlarmFilters): boolean {
  return f.severity.length > 0 || f.slotNo !== '' || f.portNo !== '' || f.logicalPortNo !== '' || f.from !== '' || f.to !== '';
}

export function AlarmsPage() {
  const [olts, setOlts] = useState<Olt[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [alarmsTotal, setAlarmsTotal] = useState(0);
  const [events, setEvents] = useState<OltGuardEvent[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [summary, setSummary] = useState<AlarmSummary | null>(null);
  const [oltWorstSeverity, setOltWorstSeverity] = useState<OltWorstSeverity>({});
  const [selectedOltIds, setSelectedOltIds] = useState<Set<string>>(new Set());
  const [collapsedCities, setCollapsedCities] = useState<Set<string>>(new Set());
  const [alarmStatusFilter, setAlarmStatusFilter] = useState<AlarmStatusFilter>('active');
  const [view, setView] = useState<View>('alarms');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<AlarmFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const oltId = selectedOltIds.size ? [...selectedOltIds] : undefined;
      const [oltsRes, alarmsRes, summaryRes, eventsRes, worstRes] = await Promise.all([
        api.listOlts(),
        api.listAlarms({
          oltId,
          condition: ALARM_STATUS_CONDITION[alarmStatusFilter],
          severity: filters.severity.length ? filters.severity : undefined,
          slotNo: filters.slotNo ? Number(filters.slotNo) : undefined,
          portNo: filters.portNo ? Number(filters.portNo) : undefined,
          logicalPortNo: filters.logicalPortNo ? Number(filters.logicalPortNo) : undefined,
          from: filters.from ? new Date(filters.from).toISOString() : undefined,
          to: filters.to ? new Date(filters.to).toISOString() : undefined,
          page,
          pageSize,
        }),
        api.alarmSummary(oltId),
        api.listEvents({ oltId, page, pageSize }),
        api.alarmSummaryByOlt(),
      ]);
      setOlts(oltsRes);
      setAlarms(alarmsRes.data);
      setAlarmsTotal(alarmsRes.total);
      setSummary(summaryRes);
      setEvents(eventsRes.data);
      setEventsTotal(eventsRes.total);
      setOltWorstSeverity(worstRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [selectedOltIds, alarmStatusFilter, filters, page, pageSize]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Qualquer mudanca de escopo (selecao de OLT, filtro, aba) invalida a
  // pagina atual - senao o usuario pode ficar "preso" numa pagina que nao
  // existe mais pro novo resultado.
  useEffect(() => {
    setPage(1);
  }, [selectedOltIds, alarmStatusFilter, filters, view]);

  function toggleSeverity(sev: AlarmSeverity) {
    setFilters((f) => ({
      ...f,
      severity: f.severity.includes(sev) ? f.severity.filter((s) => s !== sev) : [...f.severity, sev],
    }));
  }

  function toggleOltSelection(oltId: string) {
    setSelectedOltIds((prev) => {
      const next = new Set(prev);
      if (next.has(oltId)) next.delete(oltId);
      else next.add(oltId);
      return next;
    });
  }

  function toggleCitySelection(cityOlts: Olt[]) {
    setSelectedOltIds((prev) => {
      const next = new Set(prev);
      const allSelected = cityOlts.every((o) => next.has(o.id));
      for (const o of cityOlts) {
        if (allSelected) next.delete(o.id);
        else next.add(o.id);
      }
      return next;
    });
  }

  function toggleCityCollapse(city: string) {
    setCollapsedCities((prev) => {
      const next = new Set(prev);
      if (next.has(city)) next.delete(city);
      else next.add(city);
      return next;
    });
  }

  function handlePageSizeChange(size: number) {
    setPageSize(size);
    setPage(1);
  }

  const maxCount = summary ? Math.max(1, ...Object.values(summary)) : 1;

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <aside
        style={{
          width: 280,
          flexShrink: 0,
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
          background: 'var(--surface)',
        }}
      >
        <div style={sectionLabelStyle}>OLTs</div>
        <div
          onClick={() => setSelectedOltIds(new Set())}
          style={treeNodeStyle(selectedOltIds.size === 0)}
        >
          Todas as OLTs
        </div>
        {groupOltsByCity(olts).map((group) => {
          const collapsed = collapsedCities.has(group.city);
          const allSelected = group.olts.length > 0 && group.olts.every((o) => selectedOltIds.has(o.id));
          const someSelected = group.olts.some((o) => selectedOltIds.has(o.id));
          return (
            <div key={group.city}>
              <div style={cityGroupHeaderStyle}>
                <button
                  type="button"
                  onClick={() => toggleCityCollapse(group.city)}
                  style={collapseBtnStyle}
                  aria-label={collapsed ? 'Expandir cidade' : 'Minimizar cidade'}
                >
                  {collapsed ? '▸' : '▾'}
                </button>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allSelected && someSelected;
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleCitySelection(group.olts)}
                  style={checkboxStyle}
                />
                <span onClick={() => toggleCityCollapse(group.city)} style={{ cursor: 'pointer', flex: 1 }}>
                  {group.city}
                </span>
              </div>
              {!collapsed &&
                group.olts.map((olt) => (
                  <div
                    key={olt.id}
                    onClick={() => toggleOltSelection(olt.id)}
                    style={treeNodeStyle(selectedOltIds.has(olt.id))}
                  >
                    <input
                      type="checkbox"
                      checked={selectedOltIds.has(olt.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleOltSelection(olt.id)}
                      style={checkboxStyle}
                    />
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: oltDotColor(oltWorstSeverity, olt.id),
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{olt.name}</span>
                      {olt.manufacturer && (
                        <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{olt.manufacturer}</span>
                      )}
                    </span>
                  </div>
                ))}
            </div>
          );
        })}
        {olts.length === 0 && !loading && (
          <div style={{ padding: '6px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
            Nenhuma OLT cadastrada ainda.
          </div>
        )}

        <div style={{ ...sectionLabelStyle, marginTop: 6, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          Alarmes
        </div>
        <div style={{ padding: '4px 12px 16px', display: 'flex', gap: 10 }}>
          {SEVERITY_ORDER.map((sev) => {
            const count = summary?.[sev] ?? 0;
            const heightPct = Math.max(6, (count / maxCount) * 100);
            return (
              <div key={sev} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                <div style={{ width: '100%', height: 90, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                  <div
                    style={{
                      width: 22,
                      borderRadius: '4px 4px 0 0',
                      height: `${heightPct}%`,
                      background: `var(${SEVERITY_COLOR_VAR[sev]})`,
                    }}
                  />
                </div>
                <span className="mono" style={{ fontSize: 12 }}>{count}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{SEVERITY_LABEL[sev]}</span>
              </div>
            );
          })}
        </div>
      </aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, padding: '18px 22px', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', borderRadius: 8, padding: 3 }}>
              <button onClick={() => setView('alarms')} style={tabBtnStyle(view === 'alarms')}>
                Alarmes
              </button>
              <button onClick={() => setView('events')} style={tabBtnStyle(view === 'events')}>
                Eventos
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {selectedOltIds.size === 0
                ? 'Todas as OLTs'
                : selectedOltIds.size === 1
                  ? olts.find((o) => selectedOltIds.has(o.id))?.name
                  : `${selectedOltIds.size} OLTs selecionadas`}
            </div>
            {view === 'alarms' && (
              <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', borderRadius: 8, padding: 3 }}>
                <button onClick={() => setAlarmStatusFilter('active')} style={tabBtnStyle(alarmStatusFilter === 'active')}>
                  Ativos
                </button>
                <button onClick={() => setAlarmStatusFilter('inactive')} style={tabBtnStyle(alarmStatusFilter === 'inactive')}>
                  Inativos
                </button>
                <button onClick={() => setAlarmStatusFilter('all')} style={tabBtnStyle(alarmStatusFilter === 'all')}>
                  Todos
                </button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {view === 'alarms' && (
              <button onClick={() => setShowFilters((s) => !s)} style={hasActiveFilters(filters) ? primaryBtnStyle : secondaryBtnStyle}>
                Filtros{hasActiveFilters(filters) ? ` (${
                  [filters.severity.length > 0, filters.slotNo !== '', filters.portNo !== '', filters.logicalPortNo !== '', filters.from !== '' || filters.to !== '']
                    .filter(Boolean).length
                })` : ''}
              </button>
            )}
            <button onClick={() => reload()} style={secondaryBtnStyle}>Atualizar</button>
          </div>
        </div>

        {view === 'alarms' && showFilters && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={filterLabelStyle}>Severidade</span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {ALL_SEVERITIES.map((sev) => (
                  <button
                    key={sev}
                    onClick={() => toggleSeverity(sev)}
                    style={severityChipStyle(sev, filters.severity.includes(sev))}
                  >
                    {SEVERITY_LABEL[sev]}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={filterLabelStyle}>Slot</span>
              <input
                type="number"
                min={1}
                value={filters.slotNo}
                onChange={(e) => setFilters((f) => ({ ...f, slotNo: e.target.value }))}
                style={filterInputStyle}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={filterLabelStyle}>PON (porta)</span>
              <input
                type="number"
                min={1}
                value={filters.portNo}
                onChange={(e) => setFilters((f) => ({ ...f, portNo: e.target.value }))}
                style={filterInputStyle}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={filterLabelStyle}>ONU (posicao)</span>
              <input
                type="number"
                min={1}
                value={filters.logicalPortNo}
                onChange={(e) => setFilters((f) => ({ ...f, logicalPortNo: e.target.value }))}
                style={filterInputStyle}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={filterLabelStyle}>Levantado de</span>
              <input
                type="datetime-local"
                value={filters.from}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                style={filterInputStyle}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={filterLabelStyle}>Levantado ate</span>
              <input
                type="datetime-local"
                value={filters.to}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                style={filterInputStyle}
              />
            </div>
            <button onClick={() => setFilters(EMPTY_FILTERS)} disabled={!hasActiveFilters(filters)} style={secondaryBtnStyle}>
              Limpar filtros
            </button>
          </div>
        )}

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--crit-soft)', color: 'var(--crit)', fontSize: 13 }}>
            {error}
          </div>
        )}

        {view === 'alarms' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <div style={eventRowGridStyle('head')}>
                <span>Severidade</span><span>OLT</span><span>Slot/Porta</span><span>Alarme</span><span>Levantado / Resolvido</span>
              </div>

              {loading && <div style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)' }}>Carregando...</div>}

              {!loading && alarms.length === 0 && (
                <div style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)' }}>Nenhum alarme encontrado.</div>
              )}

              {alarms.map((alarm) => (
                <div key={alarm.id} style={eventRowGridStyle('row')}>
                  <span
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.03em',
                      background: `var(${SEVERITY_COLOR_VAR[alarm.severity]})`,
                      color: '#171a21',
                    }}
                  >
                    {SEVERITY_LABEL[alarm.severity]}
                  </span>
                  <span>{alarm.olt.name}</span>
                  <span className="mono" style={{ color: 'var(--text-muted)' }}>
                    {alarm.slotNo}{alarm.portNo ? `/${alarm.portNo}` : ''}{alarm.logicalPortNo ? `/${alarm.logicalPortNo}` : ''}
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span>{alarm.description ?? alarm.alarmName}{alarm.serialNumber ? ` · Serial ${alarm.serialNumber}` : ''}</span>
                    <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{alarm.alarmName}</span>
                  </span>
                  <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 11.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span>{new Date(alarm.raisedAt).toLocaleString('pt-BR')}</span>
                    <span style={{ color: alarm.clearedAt ? 'var(--ok)' : 'var(--text-muted)' }}>
                      {alarm.clearedAt ? new Date(alarm.clearedAt).toLocaleString('pt-BR') : '-'}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <PaginationBar page={page} pageSize={pageSize} total={alarmsTotal} onPageChange={setPage} onPageSizeChange={handlePageSizeChange} />
          </div>
        )}

        {view === 'events' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <div style={eventLogRowGridStyle('head')}>
                <span>Severidade</span><span>OLT</span><span>Slot/Porta</span><span>Evento</span><span>Ocorrido em</span>
              </div>

              {loading && <div style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)' }}>Carregando...</div>}

              {!loading && events.length === 0 && (
                <div style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)' }}>Nenhum evento registrado ainda.</div>
              )}

              {events.map((ev) => (
                <div key={ev.id} style={eventLogRowGridStyle('row')}>
                  <span
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.03em',
                      background: `var(${SEVERITY_COLOR_VAR[ev.severity]})`,
                      color: '#171a21',
                    }}
                  >
                    {SEVERITY_LABEL[ev.severity]}
                  </span>
                  <span>{ev.olt.name}</span>
                  <span className="mono" style={{ color: 'var(--text-muted)' }}>
                    {ev.slotNo}{ev.portNo ? `/${ev.portNo}` : ''}{ev.logicalPortNo ? `/${ev.logicalPortNo}` : ''}
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span>{ev.description ?? ev.eventName}</span>
                    <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{ev.eventName}</span>
                  </span>
                  <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {new Date(ev.occurredAt).toLocaleString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
            <PaginationBar page={page} pageSize={pageSize} total={eventsTotal} onPageChange={setPage} onPageSizeChange={handlePageSizeChange} />
          </div>
        )}
      </main>
    </div>
  );
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-muted)',
  padding: '10px 12px 6px',
};

const cityGroupHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-muted)',
  padding: '8px 8px 2px 6px',
};

const collapseBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: 10,
  padding: 2,
  lineHeight: 1,
};

const checkboxStyle: React.CSSProperties = {
  accentColor: 'var(--accent)',
  cursor: 'pointer',
  flexShrink: 0,
};

function treeNodeStyle(selected: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    margin: '0 4px',
    borderRadius: 6,
    fontSize: 13,
    cursor: 'pointer',
    color: selected ? 'var(--text)' : 'var(--text-muted)',
    fontWeight: selected ? 600 : 400,
    background: selected ? 'var(--surface-3)' : 'transparent',
  };
}

function tabBtnStyle(active: boolean): React.CSSProperties {
  return {
    fontFamily: 'var(--font-sans)',
    fontSize: 12.5,
    fontWeight: 600,
    padding: '6px 14px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    background: active ? 'var(--surface-3)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-muted)',
  };
}

function eventRowGridStyle(kind: 'head' | 'row'): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: '110px 1fr 0.7fr 2.4fr 1.2fr',
    alignItems: 'center',
    gap: 12,
    padding: '9px 14px',
    fontSize: kind === 'head' ? 10.5 : 12.5,
    textTransform: kind === 'head' ? 'uppercase' : 'none',
    letterSpacing: kind === 'head' ? '0.05em' : 'normal',
    color: kind === 'head' ? 'var(--text-muted)' : 'var(--text)',
    borderBottom: '1px solid var(--border)',
  };
}

function eventLogRowGridStyle(kind: 'head' | 'row'): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: '110px 1fr 0.7fr 2.4fr 1.1fr',
    alignItems: 'center',
    gap: 12,
    padding: '9px 14px',
    fontSize: kind === 'head' ? 10.5 : 12.5,
    textTransform: kind === 'head' ? 'uppercase' : 'none',
    letterSpacing: kind === 'head' ? '0.05em' : 'normal',
    color: kind === 'head' ? 'var(--text-muted)' : 'var(--text)',
    borderBottom: '1px solid var(--border)',
  };
}

const secondaryBtnStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: 12,
  fontWeight: 600,
  padding: '6px 10px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  color: 'var(--text)',
  cursor: 'pointer',
};

const primaryBtnStyle: React.CSSProperties = {
  ...secondaryBtnStyle,
  background: 'var(--accent)',
  borderColor: 'var(--accent)',
  color: '#171a21',
};

const filterLabelStyle: React.CSSProperties = {
  fontSize: 10.5,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-muted)',
};

const filterInputStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '6px 8px',
  color: 'var(--text)',
  fontSize: 12.5,
  fontFamily: 'var(--font-mono)',
  width: 150,
};

function severityChipStyle(sev: AlarmSeverity, active: boolean): React.CSSProperties {
  return {
    fontFamily: 'var(--font-sans)',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    padding: '4px 9px',
    borderRadius: 5,
    border: `1px solid var(${SEVERITY_COLOR_VAR[sev]})`,
    background: active ? `var(${SEVERITY_COLOR_VAR[sev]})` : 'transparent',
    color: active ? '#171a21' : `var(${SEVERITY_COLOR_VAR[sev]})`,
    cursor: 'pointer',
  };
}

function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '9px 14px',
        borderTop: '1px solid var(--border)',
        fontSize: 12,
        color: 'var(--text-muted)',
        flexWrap: 'wrap',
      }}
    >
      <span>{total === 0 ? 'Nenhum resultado' : `${from}-${to} de ${total}`}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Linhas por pagina
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            style={pageSizeSelectStyle}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} style={pagerBtnStyle(page <= 1)}>
            Anterior
          </button>
          <span className="mono" style={{ padding: '0 4px' }}>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} style={pagerBtnStyle(page >= totalPages)}>
            Proxima
          </button>
        </div>
      </div>
    </div>
  );
}

const pageSizeSelectStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '4px 6px',
  color: 'var(--text)',
  fontSize: 12,
  fontFamily: 'var(--font-sans)',
};

function pagerBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    fontFamily: 'var(--font-sans)',
    fontSize: 12,
    fontWeight: 600,
    padding: '5px 10px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text)',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}
