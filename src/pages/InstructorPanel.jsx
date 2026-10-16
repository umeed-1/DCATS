import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore, { THREAT_TYPES } from '../store';
import { loadSessions } from '../scoring/AAREngine';
import { grade } from '../scoring/DecisionTree';
import Icon from '../components/Icon';
import './InstructorPanel.css';

const GRADE_CLASS = { EXCELLENT: 'excellent', GOOD: 'good', 'NEEDS WORK': 'work', CRITICAL: 'critical' };

/* Two views, each with its own route: the session archive and the scenario
 * builder. The navbar links straight into one or the other. */
const VIEWS = {
  history: {
    title: 'Performance',
    blurb: 'Finished Trainings.',
  },
  builder: {
    title: 'Scenario Builder',
    blurb: 'Compose a custom threat mix and operating conditions.',
  },
};

const TERRAIN_OPTIONS = [
  { value: 'rural', label: 'Rural' },
  { value: 'urban', label: 'Urban' },
  { value: 'forest', label: 'Forest' },
  { value: 'mixed', label: 'Mixed' },
];

const TIME_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'dusk', label: 'Dusk' },
  { value: 'night', label: 'Night' },
];

const DURATION_OPTIONS = [60, 90, 120, 150, 180, 240];

export default function InstructorPanel({ view = 'history' }) {
  const navigate = useNavigate();
  const startSimulation = useStore(s => s.startSimulation);

  const [customThreats, setCustomThreats] = useState([]);
  const [builderTerrain, setBuilderTerrain] = useState('urban');
  const [builderTimeOfDay, setBuilderTimeOfDay] = useState('day');
  const [builderDuration, setBuilderDuration] = useState(120);
  const [builderDifficulty, setBuilderDifficulty] = useState(3);
  const [builderSnr, setBuilderSnr] = useState(0.8);
  const [builderDropout, setBuilderDropout] = useState(0.05);
  const [builderLatency, setBuilderLatency] = useState(0);
  const [builderError, setBuilderError] = useState('');
  const [history, setHistory] = useState(null); // null = loading, [] = empty

  // Local session history (IndexedDB → localStorage fallback), loaded when the
  // history view opens so freshly finished missions appear immediately.
  useEffect(() => {
    if (view !== 'history') return undefined;
    let alive = true;
    loadSessions()
      .then((rows) => { if (alive) setHistory(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (alive) setHistory([]); });
    return () => { alive = false; };
  }, [view]);

  const cohort = useMemo(() => {
    if (!history || history.length === 0) return null;
    const getDate = (session) => session.date ?? session.savedAt ?? 0;
    const getScore = (session) => (
      typeof session.score === 'number' ? session.score : session.score?.total ?? session.total ?? 0
    );
    const getScenarioName = (session) => (
      session.scenarioName
      ?? (typeof session.scenario === 'string' ? session.scenario : session.scenario?.name)
      ?? 'Unknown'
    );
    const ordered = [...history].sort((a, b) => new Date(getDate(b)) - new Date(getDate(a)));
    const totals = history.map(getScore);
    const fmt = (iso) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '—';
      return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} ` +
        `${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
    };
    return {
      count: history.length,
      avg: Math.round(totals.reduce((a, b) => a + b, 0) / totals.length),
      best: Math.max(...totals),
      lastLabel: fmt(getDate(ordered[0])),
      recent: ordered.slice(0, 8).map((s, i) => {
        const prev = ordered[i + 1];
        const score = getScore(s);
        return {
          ...s,
          displayName: getScenarioName(s),
          scoreTotal: score,
          when: fmt(getDate(s)),
          delta: prev ? score - getScore(prev) : null,
        };
      }),
    };
  }, [history]);

  const updateCustomThreat = (type, amount) => {
    setBuilderError('');
    setCustomThreats((current) => {
      const existing = current.find(t => t.type === type);
      if (!existing && amount > 0) return [...current, { type, count: amount }];
      return current
        .map(t => t.type === type ? { ...t, count: t.count + amount } : t)
        .filter(t => t.count > 0);
    });
  };

  const addCustomThreat = (type) => {
    updateCustomThreat(type, 1);
  };

  const removeCustomThreat = (type) => {
    setBuilderError('');
    setCustomThreats(current => current.filter(t => t.type !== type));
  };

  const handleCustomLaunch = () => {
    if (customThreats.length === 0) {
      setBuilderError('Add at least one threat before launching the custom scenario.');
      return;
    }

    const scenario = {
      id: `custom-${Date.now()}`,
      name: 'Instructor Custom Scenario',
      description: 'Instructor-authored scenario with a custom threat mix and operating conditions.',
      environment: builderTerrain,
      timeOfDay: builderTimeOfDay,
      difficulty: builderDifficulty,
      sensorQuality: builderSnr,
      threats: customThreats.map(({ type, count }) => ({ type, count })),
      duration: builderDuration,
      code: 'Custom',
    };

    startSimulation(scenario, {
      sensorSNR: builderSnr,
      sensorDropout: builderDropout,
      sensorLatency: builderLatency / 1000,
    });
    navigate('/simulator');
  };

  return (
    <div className="instructor">
      <div className="instructor-header animate-fade-in">
        <h1 className="section-title">{VIEWS[view]?.title ?? VIEWS.history.title}</h1>
        <p className="instructor-blurb">{VIEWS[view]?.blurb ?? VIEWS.history.blurb}</p>
      </div>

      {/* Local session history — stored on this device and portable as JSON */}
      {view === 'history' && (
        <div className="instructor-section animate-fade-in">
          <div className="archive-toolbar">
            <div>
              <div className="section-label">Performance</div>
              <p className="archive-description">Finished Traning saved on this device.</p>
            </div>
          </div>
          {history === null ? (
            <div className="card cohort-empty">
              <p className="text-muted">Loading Performance…</p>
            </div>
          ) : !cohort ? (
            <div className="card cohort-empty">
              <p className="text-muted">
                No local sessions saved on this device yet.<br />

              </p>
            </div>
          ) : (
            <>
              <div className="cohort-summary-grid">
                {[
                  { label: 'Sessions Archived', value: cohort.count },
                  { label: 'Average Score', value: cohort.avg },
                  { label: 'Best Score', value: cohort.best },
                  { label: 'Last Session', value: cohort.lastLabel },
                ].map((s, i) => (
                  <div key={s.label} className="card cohort-summary-card" style={{ animationDelay: `${i * 0.05}s` }}>
                    <span className="cohort-summary-value">{s.value}</span>
                    <span className="cohort-summary-label">{s.label}</span>
                  </div>
                ))}
              </div>
              <div className="card cohort-sessions">
                <div className="section-label">Recent Trainings</div>
                <div className="cohort-session-row cohort-session-head">
                  <span>Scenario</span>
                  <span>Date</span>
                  <span>Score</span>
                  <span>Grade</span>
                  <span>Δ</span>
                </div>
                {cohort.recent.map((s, i) => {
                  const g = grade(s.scoreTotal);
                  const detailFields = [
                    ['Scenario ID', typeof s.scenario === 'string' ? s.scenario : null],
                    ['Threats', s.threatCount],
                    ['Events', s.eventCount],
                    ['Neutralised', s.neutralised],
                    ['Simulation time', s.simTime != null ? `${s.simTime}s` : null],
                    ['Sensor SNR', s.sensorSNR != null ? `${Math.round(s.sensorSNR * 100)}%` : null],
                    ['Radar dropout', s.sensorDropout != null ? `${Math.round(s.sensorDropout * 100)}%` : null],
                    ['Detection latency', s.sensorLatency != null ? `${Math.round((s.sensorLatency || 0) * 1000)}ms` : null],
                  ].filter(([, value]) => value != null && value !== '');
                  return (
                    <div key={s.id ?? `${s.date ?? s.savedAt}-${i}`} className="cohort-session-entry">
                      <div className="cohort-session-row">
                        <span className="cohort-session-name">{s.displayName}</span>
                        <span className="cohort-session-date">{s.when}</span>
                        <span className="cohort-session-score">{s.scoreTotal}</span>
                        <span className={`cohort-session-grade ${GRADE_CLASS[g] ?? ''}`}>{g}</span>
                        <span className={`cohort-session-delta ${s.delta == null ? '' : s.delta > 0 ? 'up' : s.delta < 0 ? 'down' : ''}`}>
                          {s.delta == null ? '—' : s.delta > 0 ? `+${s.delta}` : s.delta}
                        </span>
                      </div>
                      {(detailFields.length > 0 || s.details || s.scenarioConfig) && (
                        <details className="cohort-session-detail">
                          <summary>View record details</summary>
                          {detailFields.length > 0 && (
                            <div className="cohort-detail-grid">
                              {detailFields.map(([label, value]) => (
                                <span key={label}><b>{label}</b>{value}</span>
                              ))}
                            </div>
                          )}
                          {(s.details || s.scenarioConfig) && (
                            <pre>{JSON.stringify(s.details ?? s.scenarioConfig, null, 2)}</pre>
                          )}
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Scenario Builder view */}
      {view === 'builder' && (
        <div className="instructor-section animate-fade-in">
          <div className="builder-grid">
            <div className="card">
              <div className="section-label">Add Threats</div>
              <div className="threat-type-grid">
                {Object.entries(THREAT_TYPES).map(([key, info]) => (
                  <button key={key} className="threat-type-btn" onClick={() => addCustomThreat(key)}>
                    <Icon name={key} size={16} style={{ color: info.color }} />
                    <span>{info.label}</span>
                    <span className="btn-add"><Icon name="plus" size={14} /></span>
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="section-label">Custom Scenario</div>
              {customThreats.length === 0 ? (
                <p className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>
                  No threats added yet. Select a threat type to add.
                </p>
              ) : (
                <div className="custom-threats-list">
                  {customThreats.map(t => (
                    <div key={t.type} className="custom-threat-item">
                      <Icon name={t.type} size={15} style={{ color: THREAT_TYPES[t.type].color }} />
                      <span>{THREAT_TYPES[t.type].label}</span>
                      <div className="threat-count-control">
                        <button className="count-btn" onClick={() => updateCustomThreat(t.type, -1)} aria-label={`Remove one ${THREAT_TYPES[t.type].label}`}>
                          −
                        </button>
                        <span className="count">x{t.count}</span>
                        <button className="count-btn" onClick={() => updateCustomThreat(t.type, 1)} aria-label={`Add one ${THREAT_TYPES[t.type].label}`}>
                          +
                        </button>
                      </div>
                      <button className="btn btn-ghost" onClick={() => removeCustomThreat(t.type)} aria-label={`Remove ${THREAT_TYPES[t.type].label}`}>
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="builder-fields">
                <div className="builder-field">
                  <label htmlFor="builder-terrain">Terrain</label>
                  <select id="builder-terrain" value={builderTerrain} onChange={e => setBuilderTerrain(e.target.value)}>
                    {TERRAIN_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div className="builder-field">
                  <label htmlFor="builder-time">Time of day</label>
                  <select id="builder-time" value={builderTimeOfDay} onChange={e => setBuilderTimeOfDay(e.target.value)}>
                    {TIME_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div className="builder-field">
                  <label htmlFor="builder-duration">Duration</label>
                  <select id="builder-duration" value={builderDuration} onChange={e => setBuilderDuration(Number(e.target.value))}>
                    {DURATION_OPTIONS.map(seconds => <option key={seconds} value={seconds}>{seconds} seconds</option>)}
                  </select>
                </div>
                <div className="builder-field">
                  <label htmlFor="builder-difficulty">Difficulty</label>
                  <select id="builder-difficulty" value={builderDifficulty} onChange={e => setBuilderDifficulty(Number(e.target.value))}>
                    {[1, 2, 3, 4, 5].map(level => <option key={level} value={level}>Level {level} / 5</option>)}
                  </select>
                </div>
              </div>

              <div className="builder-sensor-heading">
                <div className="section-label">Sensor Settings</div>
                <span className="text-muted">Applied to this custom run</span>
              </div>
              <div className="builder-sensor-grid">
                <div className="builder-field">
                  <label htmlFor="builder-snr">Signal clarity <b>{Math.round(builderSnr * 100)}%</b></label>
                  <input id="builder-snr" type="range" min="0.05" max="1" step="0.05" value={builderSnr} onChange={e => setBuilderSnr(Number(e.target.value))} className="sensor-slider" />
                </div>
                <div className="builder-field">
                  <label htmlFor="builder-dropout">Drone loss chance <b>{Math.round(builderDropout * 100)}%</b></label>
                  <input id="builder-dropout" type="range" min="0" max="0.5" step="0.05" value={builderDropout} onChange={e => setBuilderDropout(Number(e.target.value))} className="sensor-slider" />
                </div>
                <div className="builder-field">
                  <label htmlFor="builder-latency">Sensor delay <b>{builderLatency}ms</b></label>
                  <input id="builder-latency" type="range" min="0" max="2000" step="100" value={builderLatency} onChange={e => setBuilderLatency(Number(e.target.value))} className="sensor-slider" />
                </div>
              </div>

              <div className="builder-summary">
                <span>{customThreats.reduce((sum, threat) => sum + threat.count, 0)} threats</span>
                <span>{builderTerrain} · {builderTimeOfDay} · {builderDuration}s · difficulty {builderDifficulty}/5</span>
              </div>
              {builderError && <p className="builder-error" role="alert">{builderError}</p>}
              <button className="btn btn-primary btn-lg launch-btn" onClick={handleCustomLaunch}>
                <Icon name="play" size={14} /> Launch Custom Scenario
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
