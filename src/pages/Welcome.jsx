import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn, validatePin, validateUserId } from '../profile';
import './Welcome.css';

/**
 * Local trainee gate. The user ID is the name on the training record this
 * machine keeps; the PIN unlocks (or creates) that profile. Everything runs
 * offline — no account, no server round-trip.
 */
export default function Welcome({ session, onSignIn, onSignOut }) {
  const navigate = useNavigate();
  const [userId, setUserId] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busy) return;

    const idError = validateUserId(userId);
    const pinError = validatePin(pin);
    if (idError || pinError) {
      setError(idError || pinError);
      return;
    }

    setBusy(true);
    setError('');
    try {
      const nextSession = await signIn(userId, pin);
      onSignIn(nextSession);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err?.message || 'Could not sign in on this device.');
      setBusy(false);
    }
  };

  const handleSwitch = () => {
    onSignOut?.();
    setUserId('');
    setPin('');
    setError('');
    setBusy(false);
  };

  return (
    <div className="welcome">
      <header className="welcome-brand animate-fade-in">
        <h1 className="welcome-brand-name">DCATS</h1>
        <p className="welcome-brand-sub">Drone Countermeasure and Assessment Training System</p>
      </header>

      <section className="welcome-card card animate-fade-in">
        {session ? (
          <>
            <div className="welcome-card-head">
              <h2 className="welcome-card-title">{session.userId}</h2>
              <p className="welcome-card-help">Signed in on this device.</p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-lg welcome-submit"
              onClick={() => navigate('/')}
            >
              Continue to console
            </button>
            <button
              type="button"
              className="btn btn-outline welcome-submit"
              onClick={handleSwitch}
            >
              Switch user
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="welcome-card-head">
              <h2 className="welcome-card-title">Welcome</h2>
              <p className="welcome-card-help">
                Enter your user ID and Passkey.
              </p>
            </div>

            <label className="welcome-field">
              <span>User ID</span>
              <input
                value={userId}
                onChange={(event) => { setUserId(event.target.value); setError(''); }}
                placeholder="TEST01"
                autoComplete="username"
                autoFocus
                maxLength={24}
                spellCheck={false}
              />
            </label>

            <label className="welcome-field">
              <span>PASSKEY</span>
              <div className="welcome-pin">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(event) => {
                    setPin(event.target.value.replace(/\D/g, '').slice(0, 6));
                    setError('');
                  }}
                  placeholder="Enter Passkey"
                  inputMode="numeric"
                  autoComplete="current-password"
                  maxLength={6}
                />
                <button
                  type="button"
                  className="welcome-show"
                  onClick={() => setShowPin((visible) => !visible)}
                  aria-label={showPin ? 'Hide' : 'Show'}
                >
                  {showPin ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            {error && <div className="welcome-error" role="alert">{error}</div>}

            <button type="submit" className="btn btn-primary btn-lg welcome-submit" disabled={busy}>
              {busy ? 'Checking…' : 'START TRAINING'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
