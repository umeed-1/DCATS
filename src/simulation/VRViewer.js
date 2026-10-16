/**
 * DCATS — VRViewer.js
 * YouTube-VR-style look-around view for the 3D battlefield.
 *
 * This is an immersive WebXR viewer, not a controller-based operator console:
 * the headset provides stereo rendering and head tracking, and the camera stays
 * at the current desktop viewpoint. The desktop HUD, track tags and buttons are
 * intentionally left on the monitor; the headset shows the battlefield itself.
 * Full controller / in-VR action workflow remains phase 2.
 */

const STATUS_TTL = 5200;

/**
 * Add the Enter VR control and wire the immersive session lifecycle.
 * Call once per renderer. The caller is responsible for not updating the
 * desktop orbit camera while `renderer.xr.isPresenting` is true.
 */
export function createVRViewer({ renderer, mount }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sim-vr-button';
  button.title = 'Enter VR';
  button.setAttribute('aria-label', 'Enter VR');
  button.setAttribute('aria-pressed', 'false');

  // Icon only, matching the Full View control: a headset outline that gains a
  // filled strap when a session is live, so the chip reads without a label.
  button.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M3.5 8h17a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 20.5 16h-5.2a2 2 0 0 1-1.6-.8l-.5-.7a1.5 1.5 0 0 0-2.4 0l-.5.7a2 2 0 0 1-1.6.8H3.5A1.5 1.5 0 0 1 2 14.5v-5A1.5 1.5 0 0 1 3.5 8Z" />
      <circle class="sim-vr-eye" cx="7.2" cy="12" r="1.5" />
      <circle class="sim-vr-eye" cx="16.8" cy="12" r="1.5" />
    </svg>`;

  const status = document.createElement('div');
  status.className = 'sim-vr-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  mount.append(button, status);

  let statusTimer = null;
  let disposed = false;
  let supported = null;

  // Pre-flight the headset check so a desktop click explains the absence
  // without asking the XR runtime for a session it cannot create. The click
  // path below still calls requestSession() directly (no await first), so a
  // real headset keeps the browser's transient user activation.
  if (navigator.xr?.isSessionSupported) {
    navigator.xr.isSessionSupported('immersive-vr')
      .then((value) => {
        supported = value === true;
        button.classList.toggle('is-available', supported);
        if (!supported) button.title = 'No VR headset detected — connect a headset and reload';
      })
      .catch(() => { supported = false; });
  } else {
    supported = false;
  }

  const showStatus = (message, ttl = STATUS_TTL) => {
    if (disposed) return;
    status.textContent = message;
    status.classList.add('is-visible');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      status.classList.remove('is-visible');
    }, ttl);
  };

  const setPresenting = (presenting) => {
    button.title = presenting ? 'Exit VR' : 'Enter VR';
    button.setAttribute('aria-label', presenting ? 'Exit VR' : 'Enter VR');
    button.setAttribute('aria-pressed', presenting ? 'true' : 'false');
    button.classList.toggle('is-active', presenting);
    button.querySelectorAll('.sim-vr-eye').forEach((eye) => {
      eye.setAttribute('fill', presenting ? 'currentColor' : 'none');
    });
  };

  const onSessionStart = () => {
    setPresenting(true);
    showStatus('VR active — move your head to look around. Use the headset menu to exit.');
  };

  const onSessionEnd = () => {
    setPresenting(false);
    showStatus('VR view ended.');
  };

  const onClick = async () => {
    if (renderer.xr.isPresenting) {
      try {
        await renderer.xr.getSession()?.end();
      } catch {
        showStatus('Could not exit VR. Use the headset menu instead.');
      }
      return;
    }

    if (!navigator.xr?.requestSession) {
      showStatus('WebXR is not available in this browser. Use Chrome or Edge on a VR-capable device.');
      return;
    }

    if (supported === false) {
      showStatus('No VR headset detected. Connect a headset, then reload this page.', STATUS_TTL * 2);
      return;
    }

    try {
      // Request directly from the click so the browser still has transient
      // user activation. A pre-flight isSessionSupported() await can consume it.
      const session = await navigator.xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
      });
      await renderer.xr.setSession(session);
    } catch (err) {
      const name = err?.name || '';
      if (name === 'NotSupportedError') {
        showStatus('No VR headset detected. Connect a headset and try again.', STATUS_TTL * 2);
      } else if (name === 'SecurityError') {
        showStatus('VR needs a secure context — use HTTPS or localhost.');
      } else if (name === 'InvalidStateError') {
        showStatus('A VR session is already active.');
      } else {
        showStatus(`Could not start VR${err?.message ? `: ${err.message}` : '.'}`);
      }
    }
  };

  renderer.xr.addEventListener('sessionstart', onSessionStart);
  renderer.xr.addEventListener('sessionend', onSessionEnd);
  button.addEventListener('click', onClick);

  return {
    dispose() {
      disposed = true;
      button.removeEventListener('click', onClick);
      renderer.xr.removeEventListener('sessionstart', onSessionStart);
      renderer.xr.removeEventListener('sessionend', onSessionEnd);
      clearTimeout(statusTimer);
      try {
        renderer.xr.getSession()?.end();
      } catch {
        /* session already closed */
      }
      button.remove();
      status.remove();
    },
  };
}

export default createVRViewer;
