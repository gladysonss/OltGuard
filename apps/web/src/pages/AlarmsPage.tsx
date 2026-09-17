import { useCallback, useEffect, useState } from 'react';
import { api, type Alarm, type AlarmCondition, type AlarmSeverity, type AlarmSummary, type Olt, type OltGuardEvent } from '../api';
import { SEVERITY_COLOR_VAR, SEVERITY_LABEL, SEVERITY_ORDER } from '../severity';

type View = 'alarms' | 'events';
type AlarmStatusFilter = 'active' | 'inactive' | 'all';

const SEVERITY_RANK: Record<AlarmSeverity, number> = {
  CRITICAL: 5,
  MAJOR: 4,
  MINOR: 3,
  WARNING: 2,
  INFO: 1,
  CLEAR: 0,
};

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

function worstSeverityColor(alarms: Alarm[], oltId: string): string {
  const oltAlarms = alarms.filter((a) => a.oltId === oltId);
  if (oltAlarms.length === 0) return 'var(--ok)';
  const worst = oltAlarms.reduce((acc, a) =>
    SEVERITY_RANK[a.severity] > SEVERITY_RANK[acc.severity] ? a : acc,
  );
  return `var(${SEVERITY_COLOR_VAR[worst.severity]})`;
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
  const [events, setEvents] = useState<OltGuardEvent[]>([]);
  const [summary, setSummary] = useState<AlarmSummary | null>(null);
  const [selectedOltId, setSelectedOltId] = useState<string | undefined>(undefined);
  const [alarmStatusFilter, setAlarmStatusFilter] = useState<AlarmStatusFilter>('active');
  const [view, setView] = useState<View>('alarms');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<AlarmFilters>(EMPTY_FILTERS);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [oltsRes, alarmsRes, summaryRes, eventsRes] = await Promise.all([
        api.listOlts(),
        api.listAlarms({
          oltId: selectedOltId,
          condition: ALARM_STATUS_CONDITION[alarmStatusFilter],
          severity: filters.severity.length ? filters.severity : undefined,
          slotNo: filters.slotNo ? Number(filters.slotNo) : undefined,
          portNo: filters.portNo ? Number(filters.portNo) : undefined,
          logicalPortNo: filters.logicalPortNo ? Number(filters.logicalPortNo) : undefined,
          from: filters.from ? new Date(filters.from).toISOString() : undefined,
          to: filters.to ? new Date(filters.to).toISOString() : undefined,
        }),
        api.alarmSummary(selectedOltId),
        api.listEvents({ oltId: selectedOltId }),
      ]);
      setOlts(oltsRes);
      setAlarms(alarmsRes);
      setSummary(summaryRes);
      setEvents(eventsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [selectedOltId, alarmStatusFilter, filters]);

  useEffect(() => {
    reload();
  }, [reload]);

  function toggleSeverity(sev: AlarmSeverity) {
    setFilters((f) => ({
      ...f,
      severity: f.severity.includes(sev) ? f.severity.filter((s) => s !== sev) : [...f.severity, sev],
    }));
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
          onClick={() => setSelectedOltId(undefined)}
          style={treeNodeStyle(selectedOltId === undefined)}
        >
          Todas as OLTs
        </div>
        {groupOltsByCity(olts).map((group) => (
          <div key={group.city}>
            <div style={cityGroupLabelStyle}>{group.city}</div>
            {group.olts.map((olt) => (
              <div
                key={olt.id}
                onClick={() => setSelectedOltId(olt.id)}
                style={treeNodeStyle(selectedOltId === olt.id)}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: worstSeverityColor(alarms, olt.id),
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
        ))}
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
              {selectedOltId ? olts.find((o) => o.id === selectedOltId)?.name : 'Todas as OLTs'}
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
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'auto' }}>
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
        )}

        {view === 'events' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'auto' }}>
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

const cityGroupLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-muted)',
  padding: '8px 12px 2px',
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
