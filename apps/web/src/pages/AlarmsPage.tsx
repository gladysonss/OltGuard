import { useCallback, useEffect, useState } from 'react';
import { api, type Alarm, type AlarmSeverity, type AlarmSummary, type NeStatus, type Olt, type OltGuardEvent } from '../api';
import { SEVERITY_COLOR_VAR, SEVERITY_LABEL, SEVERITY_ORDER } from '../severity';

type View = 'alarms' | 'events';
type NeStatusFilter = NeStatus | 'all';

const SEVERITY_RANK: Record<AlarmSeverity, number> = {
  CRITICAL: 5,
  MAJOR: 4,
  MINOR: 3,
  WARNING: 2,
  INFO: 1,
  CLEAR: 0,
};

function worstSeverityColor(alarms: Alarm[], oltId: string): string {
  const oltAlarms = alarms.filter((a) => a.oltId === oltId);
  if (oltAlarms.length === 0) return 'var(--ok)';
  const worst = oltAlarms.reduce((acc, a) =>
    SEVERITY_RANK[a.severity] > SEVERITY_RANK[acc.severity] ? a : acc,
  );
  return `var(${SEVERITY_COLOR_VAR[worst.severity]})`;
}

export function AlarmsPage() {
  const [olts, setOlts] = useState<Olt[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [events, setEvents] = useState<OltGuardEvent[]>([]);
  const [summary, setSummary] = useState<AlarmSummary | null>(null);
  const [selectedOltId, setSelectedOltId] = useState<string | undefined>(undefined);
  const [neStatusFilter, setNeStatusFilter] = useState<NeStatusFilter>('all');
  const [view, setView] = useState<View>('alarms');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [oltsRes, alarmsRes, summaryRes, eventsRes] = await Promise.all([
        api.listOlts(),
        api.listAlarms({ oltId: selectedOltId, neStatus: neStatusFilter === 'all' ? undefined : neStatusFilter }),
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
  }, [selectedOltId, neStatusFilter]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function runAction(id: string, action: 'confirm' | 'clear' | 'confirm-and-clear') {
    setActioningId(id);
    try {
      if (action === 'confirm') await api.confirmAlarm(id);
      if (action === 'clear') await api.clearAlarm(id);
      if (action === 'confirm-and-clear') await api.confirmAndClearAlarm(id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar alarme');
    } finally {
      setActioningId(null);
    }
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
        {olts.map((olt) => (
          <div
            key={olt.id}
            onClick={() => setSelectedOltId(olt.id)}
            style={{ ...treeNodeStyle(selectedOltId === olt.id), opacity: olt.reachable ? 1 : 0.55 }}
            title={olt.reachable ? 'NE ativa' : 'NE inativa - sem resposta ao ultimo SNMP GET'}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: olt.reachable ? worstSeverityColor(alarms, olt.id) : 'var(--unknown)',
                flexShrink: 0,
              }}
            />
            {olt.name}
            {!olt.reachable && (
              <span style={{ fontSize: 9.5, color: 'var(--unknown)', marginLeft: 'auto' }}>OFFLINE</span>
            )}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
                <button onClick={() => setNeStatusFilter('all')} style={tabBtnStyle(neStatusFilter === 'all')}>
                  Todas as NEs
                </button>
                <button onClick={() => setNeStatusFilter('active')} style={tabBtnStyle(neStatusFilter === 'active')}>
                  NEs Ativas
                </button>
                <button onClick={() => setNeStatusFilter('inactive')} style={tabBtnStyle(neStatusFilter === 'inactive')}>
                  NEs Inativas
                </button>
              </div>
            )}
          </div>
          <button onClick={() => reload()} style={secondaryBtnStyle}>Atualizar</button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--crit-soft)', color: 'var(--crit)', fontSize: 13 }}>
            {error}
          </div>
        )}

        {view === 'alarms' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'auto' }}>
            <div style={eventRowGridStyle('head')}>
              <span>Severidade</span><span>OLT</span><span>Slot/Porta</span><span>Alarme</span><span>Confirmacao</span><span>Data</span><span>Acoes</span>
            </div>

            {loading && <div style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)' }}>Carregando...</div>}

            {!loading && alarms.length === 0 && (
              <div style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)' }}>Nenhum alarme ativo.</div>
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
                <span>
                  {alarm.olt.name}
                  {!alarm.olt.reachable && (
                    <span style={{ marginLeft: 6, fontSize: 9.5, color: 'var(--unknown)' }}>OFFLINE</span>
                  )}
                </span>
                <span className="mono" style={{ color: 'var(--text-muted)' }}>
                  {alarm.slotNo}{alarm.portNo ? `/${alarm.portNo}` : ''}{alarm.logicalPortNo ? `/${alarm.logicalPortNo}` : ''}
                </span>
                <span className="mono">{alarm.alarmName}</span>
                <span style={{ color: 'var(--text-muted)' }}>{alarm.confirmed ? 'Confirmado' : 'Nao confirmado'}</span>
                <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  {new Date(alarm.raisedAt).toLocaleString('pt-BR')}
                </span>
                <span style={{ display: 'flex', gap: 6 }}>
                  <button
                    disabled={actioningId === alarm.id || alarm.confirmed}
                    onClick={() => runAction(alarm.id, 'confirm')}
                    style={secondaryBtnStyle}
                  >
                    Confirmar
                  </button>
                  <button
                    disabled={actioningId === alarm.id}
                    onClick={() => runAction(alarm.id, 'confirm-and-clear')}
                    style={primaryBtnStyle}
                  >
                    Limpar
                  </button>
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
                <span className="mono">{ev.eventName}</span>
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
    gridTemplateColumns: '110px 1.1fr 0.8fr 1.2fr 1fr 1fr 1.4fr',
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
    gridTemplateColumns: '110px 1.1fr 0.8fr 1.6fr 1.2fr',
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
