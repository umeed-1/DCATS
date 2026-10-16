import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore, { SCENARIOS, THREAT_TYPES } from '../store';
import Icon from '../components/Icon';
import { loadSessionsForTrainee, sessionsForTrainee } from '../scoring/AAREngine';
import { buildTrainingPlan, mergeSessionHistory } from '../scoring/TrainingPlanner';
import { readSession } from '../profile';
import './Landing.css';

export default function Landing() {
  const navigate = useNavigate();
  const selectScenario = useStore(s => s.selectScenario);
  const startSimulation = useStore(s => s.startSimulation);
  const sessionHistory = useStore(s => s.sessionHistory);
  const traineeId = readSession()?.userId ?? null;

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

  // Latest completed session → the AI advisor's pick for the next mission.
  const recommendedScenarioId = useMemo(() => {
    const all = mergeSessionHistory(
      sessionsForTrainee(sessionHistory, traineeId),
      archivedSessions
    );
    const latest = all[all.length - 1];
    if (!latest) return null;
    const plan = buildTrainingPlan({
      score: typeof latest.score === 'number' ? { total: latest.score } : (latest.score ?? {}),
      threats: latest.details?.threats ?? [],
      events: latest.details?.events ?? [],
      history: all.slice(0, -1),
      scenarios: SCENARIOS,
      labels: Object.fromEntries(
        Object.entries(THREAT_TYPES).map(([key, value]) => [key, value.label])
      ),
      currentScenarioId: latest.scenarioConfig?.id ?? latest.scenario ?? null,
    });
    return plan.missions[0]?.id ?? null;
  }, [sessionHistory, archivedSessions, traineeId]);

  const handleLaunch = (scenarioId) => {
    selectScenario(scenarioId);
    const scenario = SCENARIOS.find(s => s.id === scenarioId);
    startSimulation(scenario);
    navigate('/simulator');
  };

  const difficultyLabel = (d) => (d === 0 ? 'Varies' : `Level ${d} / 5`);

  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-content animate-fade-in">

          <h1 className="hero-title">DCATS</h1>
          <p className="hero-subtitle">Drone Countermeasure and Assessment Training System</p>
          <p className="hero-desc">
            Train to detect, independently classify, and safely respond to drone threats — from solo
            scouts to coordinated swarms — in an offline-first simulator.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-lg" onClick={() => handleLaunch(recommendedScenarioId ?? 'basic-recon')}>
              Start AI Personalized Training <Icon name="arrowRight" size={14} />
            </button>
            <button
              className="btn btn-outline btn-lg"
              onClick={() => document.getElementById('scenarios')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              Customize Training
            </button>
          </div>
        </div>
        <svg
          className="hero-radar"
          viewBox="0 0 360 360"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            {/* Sweep trail fades out behind the leading edge. */}
            <linearGradient
              id="radar-sweep-fade"
              gradientUnits="userSpaceOnUse"
              x1="0" y1="-164"
              x2="-134.3" y2="-94"
            >
              <stop className="radar-sweep-stop-lead" offset="0" />
              <stop className="radar-sweep-stop-tail" offset="1" />
            </linearGradient>
          </defs>
          <g transform="translate(180 180)">
            <circle className="radar-ring radar-ring-outer" r="164" />
            <circle className="radar-ring radar-ring-mid" r="110" />
            <circle className="radar-ring radar-ring-inner" r="56" />
            <line className="radar-axis" x1="-164" y1="0" x2="164" y2="0" />
            <line className="radar-axis" x1="0" y1="-164" x2="0" y2="164" />

            <g className="radar-sweep">
              <path d="M0 0 L0 -164 A164 164 0 0 0 -134.3 -94 Z" fill="url(#radar-sweep-fade)" />
              <line className="radar-sweep-edge" x1="0" y1="0" x2="0" y2="-164" />
            </g>

            <circle className="radar-blip" cx="80" cy="-58" r="3.5" style={{ animationDelay: '0s' }} />
            <circle className="radar-blip" cx="-72" cy="62" r="3.5" style={{ animationDelay: '1s' }} />
            <circle className="radar-blip" cx="50" cy="83" r="3.5" style={{ animationDelay: '2s' }} />

            <circle className="radar-center-ring" r="9" />
            <circle className="radar-center-dot" r="2.5" />
          </g>
        </svg>
      </section>

      {/* Scenario Grid */}
      <section className="scenarios-section" id="scenarios">
        <div className="section-header">
          <h2 className="section-title">Choose Your Training</h2>
        </div>
        <div className="scenario-grid">
          {SCENARIOS.map((sc) => (
            <div key={sc.id} className="scenario-card card">
              <div className="scenario-card-header">
                {sc.id === recommendedScenarioId && <span className="scenario-reco">AI pick</span>}
                <span className="scenario-difficulty">{difficultyLabel(sc.difficulty)}</span>
              </div>
              <h3 className="scenario-name">{sc.name}</h3>
              <p className="scenario-desc">{sc.description}</p>
              <button className="btn btn-primary btn-launch" onClick={() => handleLaunch(sc.id)}>
                Start
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>DCATS — Drone Countermeasure and Assessment Training System</p>
        <p className="text-muted">Made with Love by Team Trath</p>
      </footer>
    </div>
  );
}
