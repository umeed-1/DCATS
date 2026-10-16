import React, { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Link, Navigate, useLocation } from 'react-router-dom';
import Landing from './pages/Landing';
import Simulator from './pages/Simulator';
import AAR from './pages/AAR';
import InstructorPanel from './pages/InstructorPanel';
import Welcome from './pages/Welcome';
import ErrorBoundary from './components/ErrorBoundary';
import Icon from './components/Icon';
import { readSession, clearSession } from './profile';
import useStore from './store';

/* Unknown hash/path fallback — keeps the shell intact instead of a blank
 * content area under the navbar. */
function NotFound() {
  return (
    <div className="error-boundary card">
      <span className="error-boundary-icon"><Icon name="alert" size={22} /></span>
      <h2>Page not found</h2>
      <p className="text-secondary">That address does not exist in the trainer.</p>
      <div className="error-boundary-actions">
        <Link to="/" className="btn btn-primary">Back to Mission Brief</Link>
      </div>
    </div>
  );
}

function Navbar({ session, onSignOut }) {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <div className="navbar-brand-icon"><Icon name="shield" size={17} /></div>
        <span className="navbar-brand-text">DCATS</span>
      </div>
      <ul className="navbar-links">
        <li><NavLink to="/" end>Home</NavLink></li>
        <li><NavLink to="/instructor/history">History</NavLink></li>
        <li><NavLink to="/instructor/builder">Builder</NavLink></li>
        <li className="navbar-user">
          <span className="navbar-user-id" title="Signed-in trainee">{session?.userId}</span>
          <button type="button" className="navbar-signout" onClick={onSignOut}>Sign out</button>
        </li>
      </ul>
    </nav>
  );
}

function App() {
  const location = useLocation();
  const [session, setSession] = useState(() => readSession());
  const setActiveTrainee = useStore((state) => state.setActiveTrainee);

  // Tag every archived session with the active profile and drop another
  // trainee's in-memory runs the moment the profile changes.
  useEffect(() => {
    setActiveTrainee(session?.userId ?? null);
  }, [session?.userId, setActiveTrainee]);

  const handleSignOut = () => {
    clearSession();
    setSession(null);
  };

  // The simulator runs as a full-dark operator console — no light app chrome.
  const immersive = location.pathname === '/simulator';
  const atWelcome = location.pathname === '/welcome';
  const plainPage = location.pathname === '/' || atWelcome;

  if (!session) {
    return (
      <div className="page-content page-content-welcome page-content-white">
        <ErrorBoundary key={location.pathname}>
          <Routes>
            <Route path="/welcome" element={<Welcome onSignIn={setSession} />} />
            <Route path="*" element={<Navigate to="/welcome" replace />} />
          </Routes>
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <>
      {!immersive && !atWelcome && <Navbar session={session} onSignOut={handleSignOut} />}
      <div className={`page-content${immersive ? ' page-content-console' : ''}${atWelcome ? ' page-content-welcome' : ''}${plainPage ? ' page-content-white' : ''}`}>
        {/* Keyed by route so navigating away resets a failed view. */}
        <ErrorBoundary key={location.pathname}>
          <Routes>
            <Route
              path="/welcome"
              element={<Welcome session={session} onSignIn={setSession} onSignOut={handleSignOut} />}
            />
            <Route path="/" element={<Landing />} />
            <Route path="/simulator" element={<Simulator />} />
            <Route path="/aar" element={<AAR />} />
            <Route path="/instructor" element={<Navigate to="/instructor/history" replace />} />
            <Route path="/instructor/history" element={<InstructorPanel view="history" />} />
            <Route path="/instructor/builder" element={<InstructorPanel view="builder" />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </div>
    </>
  );
}

export default App;
