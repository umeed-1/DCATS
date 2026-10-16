import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useStore, { SCENARIOS, THREAT_TYPES } from '../store';
import Icon from '../components/Icon';
import { trackLabel, trackNum } from '../utils/format';
import {
  detectionTimes as buildDetectionTimes,
  threatSummary as buildThreatSummary,
  recommendations as buildRecommendations,
  loadSessionsForTrainee,
  sessionsForTrainee,
} from '../scoring/AAREngine';
import { buildTrainingPlan, mergeSessionHistory } from '../scoring/TrainingPlanner';
import { grade } from '../scoring/DecisionTree';
import { readSession } from '../profile';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import './AAR.css';

const TOOLTIP_STYLE = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: '5px',
  fontSize: '12px',
};

/* Log entries read in past tense — the chip says what happened to the track. */
const EVENT_LABELS = { track: 'ACQUIRED', classify: 'CLASSIFIED', alert: 'ALERTED', engage: 'ENGAGED' };

/* Same grade → colour mapping the local instructor history uses. */
const GRADE_CLASS = { EXCELLENT: 'good', GOOD: 'good', 'NEEDS WORK': 'work', CRITICAL: 'critical' };

export default function AAR() {
  const navigate = useNavigate();
  const {
    simStatus, score, events, threats, selectedScenario, retrySimulation,
    sessionHistory, lastSession, selectScenario, startSimulation,
  } = useStore();

  const traineeId = readSession()?.userId ?? null;

  // Archived sessions power the cross-session trend, so the plan still knows
  // the trainee's history after a browser restart — and only that trainee's.
  const [archivedSessions, setArchivedSessions] = useState([]);
  useEffect(() => {
    let mounted = true;
    if (!traineeId) {
      setArchivedSessions([]);
      return () => { mounted = false; };
    }
    loadSessionsForTrainee(traineeId)
      .then((records) => { if (mounted) setArchivedSessions(records ?? []); })
      .catch(() => { });
    return () => { mounted = false; };
  }, [traineeId]);

  const pastSessions = useMemo(
    () => mergeSessionHistory(
      sessionsForTrainee(sessionHistory, traineeId),
      archivedSessions,
      lastSession?.id ?? null
    ),
    [sessionHistory, archivedSessions, lastSession, traineeId]
  );

  const trainingPlan = useMemo(
    () => buildTrainingPlan({
      score,
      threats,
      events,
      history: pastSessions,
      scenarios: SCENARIOS,
      labels: Object.fromEntries(
        Object.entries(THREAT_TYPES).map(([key, value]) => [key, value.label])
      ),
      currentScenarioId: selectedScenario?.id ?? null,
    }),
    [score, threats, events, pastSessions, selectedScenario]
  );

  const startRecommended = (scenarioId) => {
    const scenario = SCENARIOS.find(s => s.id === scenarioId);
    if (!scenario) return;
    selectScenario(scenarioId);
    startSimulation(scenario);
    navigate('/simulator');
  };

  const classificationData = useMemo(
    () => threats
      .filter(t => t.classified)
      .map(t => ({
        id: t.id,
        actual: THREAT_TYPES[t.type]?.label || t.type,
        called: THREAT_TYPES[t.classifiedAs]?.label || t.classifiedAs,
        source: t.classificationSource === 'ai-accepted' ? 'AI accepted' : 'Trainee override',
        correct: t.classCorrect,
      })),
    [threats]
  );

  const detectionTimes = useMemo(() => buildDetectionTimes(threats), [threats]);

  const threatSummary = useMemo(() => buildThreatSummary(threats), [threats]);

  const recommendations = useMemo(
    () => buildRecommendations(score, threatSummary),
    [score, threatSummary]
  );

  if (simStatus === 'idle') {
    return (
      <div className="aar-empty">
        <h2>No Training Results Yet</h2>
        <p className="text-secondary">Complete a training session and your performance dashboard will appear here.</p>
        <Link to="/" className="btn btn-primary btn-lg">
          <Icon name="arrowLeft" size={14} /> Back to Mission Brief
        </Link>
      </div>
    );
  }

  return (
    <div className="aar">
      <div className="aar-header animate-fade-in">
        <div>
          <h1 className="section-title">Performance Dashboard</h1>
        </div>
        <div className="aar-score-badge">
          <span className="aar-score-label">TRAINING SCORE</span>
          <span className="aar-score-value">{score.total}</span>
          <span className={`aar-score-grade ${GRADE_CLASS[grade(score.total)] ?? ''}`}>
            {grade(score.total)}
          </span>
        </div>
      </div>

      {/* AI Training Advisor — personalised plan from this session + archive */}
      <div className="aar-plan card">
        <div className="aar-plan-head">
          <div>
            <div className="section-label">AI Training Advisor</div>
            <h3 className="aar-plan-title">Your Personalised Training Plan</h3>
          </div>
        </div>
        <p className="aar-plan-intro">{trainingPlan.summary}</p>

        <div className="plan-focus-list">
          {trainingPlan.focus.map((item) => (
            <div key={item.id} className={`plan-focus plan-${item.severity}`}>
              <div className="plan-focus-head">
                <span className="plan-focus-title">{item.title}</span>
                <span className="plan-focus-score">{item.value}%</span>
              </div>
              <p className="plan-focus-why">{item.why}</p>
              <ul className="plan-drills">
                {item.drills.map((drill, i) => <li key={i}>{drill}</li>)}
              </ul>
            </div>
          ))}
        </div>

        {trainingPlan.trend && (
          <div className="plan-trend">
            <span className="plan-trend-label">Trend · {trainingPlan.trend.sessions} sessions</span>
            <span className="plan-trend-text">{trainingPlan.trend.headline}</span>
          </div>
        )}

        {trainingPlan.missions.length > 0 && (
          <div className="plan-missions">
            <span className="plan-missions-label">Recommended next missions</span>
            {trainingPlan.missions.map((mission) => (
              <div key={mission.id} className="plan-mission">
                <div className="plan-mission-info">
                  <span className="plan-mission-code">{mission.code}</span>
                  <span className="plan-mission-name">{mission.name}</span>
                  <span className="plan-mission-reason">{mission.reason}</span>
                  <span className="plan-mission-goal">Goal · {mission.goal}</span>
                </div>
                <button className="btn btn-primary" onClick={() => startRecommended(mission.id)}>
                  Start Mission
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="plan-notes">
          <span className="plan-missions-label">Coach's notes</span>
          <div className="rec-list">
            {recommendations.map((rec, i) => (
              <div key={i} className={`rec-item rec-${rec.severity}`}>{rec.text}</div>
            ))}
          </div>
        </div>

        <details className="plan-how">
          <summary>How this plan was computed</summary>
          <ul>
            {trainingPlan.rules.map((rule, i) => <li key={i}>{rule}</li>)}
          </ul>
        </details>
      </div>

      {/* Event Timeline */}
      <div className="aar-timeline card">
        <div className="section-label">Training Activity</div>
        <div className="timeline-entries">
          {events.map((ev, i) => (
            <div key={i} className="timeline-entry">
              <span className="timeline-dot" data-type={ev.type} />
              <span className="timeline-time">{ev.time.toFixed(1)}s</span>
              <span className={`event-type event-type-${ev.type}`}>{EVENT_LABELS[ev.type] || ev.type.toUpperCase()}</span>
              <span className="timeline-detail">
                {trackLabel(ev.threatId)}
                {ev.type === 'classify' && ` — ${THREAT_TYPES[ev.classification]?.label || ev.classification} (${ev.correct ? 'correct' : 'incorrect'})`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="aar-summary-grid">
        {[
          { label: 'Threats in session', value: threatSummary.total, icon: 'crosshair', color: 'var(--accent)' },
          { label: 'Drones acquired', value: threatSummary.tracked, icon: 'radar', color: 'var(--warn)' },
          { label: 'Your identifications', value: threatSummary.classified, icon: 'tag', color: 'var(--violet)' },
          { label: 'Correct answers', value: threatSummary.correct, icon: 'check', color: 'var(--safe)' },
          { label: 'Teams notified', value: threatSummary.alerted, icon: 'alert', color: 'var(--warn)' },
          { label: 'Threats resolved', value: threatSummary.neutralised, icon: 'shield', color: 'var(--threat)' },
          { label: 'Missed / incomplete', value: threatSummary.missed, icon: 'alert', color: 'var(--threat)' },
          { label: 'Manual choices', value: threatSummary.overrides, icon: 'tag', color: 'var(--accent)' },
        ].map((card, i) => (
          <div key={i} className="aar-summary-card card" style={{ animationDelay: `${i * 0.05}s` }}>
            <span className="aar-summary-icon"><Icon name={card.icon} size={18} /></span>
            <span className="aar-summary-value" style={{ color: card.color }}>{card.value}</span>
            <span className="aar-summary-label">{card.label}</span>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="aar-charts-grid">
        {/* Classification Results */}
        <div className="aar-chart-card card">
          <div className="section-label">Your Identification Calls</div>
          {classificationData.length === 0 ? (
            <p className="text-muted" style={{ padding: '1rem 0' }}>No drones classified in this mission.</p>
          ) : (
            <div className="confusion-table">
              <div className="confusion-row confusion-header">
                <span>Drone</span><span>Ground truth</span><span>Trainee call</span><span>Source</span>
              </div>
              {classificationData.map((row) => (
                <div key={row.id} className="confusion-row">
                  <span className="confusion-pair">{trackNum(row.id)}</span>
                  <span className="confusion-pair">{row.actual}</span>
                  <span className={row.correct ? 'text-safe' : 'text-threat'}>{row.called}</span>
                  <span className="confusion-source">{row.source}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="aar-chart-card card">
        <div className="section-label">Time to Find Each Drone</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={detectionTimes}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="id" stroke="var(--text-muted)" tick={{ fontSize: 10 }} tickFormatter={trackNum} />
            <YAxis stroke="var(--text-muted)" tick={{ fontSize: 10 }} label={{ value: 'Seconds', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 10 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={trackLabel} />
            <Bar dataKey="detectionTime" name="Seconds" fill="var(--warn)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Actions */}
      <div className="aar-actions">
        <Link to="/" className="btn btn-outline btn-lg">Start New Training</Link>
        <Link
          to="/simulator"
          className="btn btn-primary btn-lg"
          onClick={() => retrySimulation()}
        >
          Retry Mission
        </Link>
      </div>
    </div>
  );
}
