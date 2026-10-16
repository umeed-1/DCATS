import React from 'react';

/**
 * DCATS — Icon
 * Stroke-based SVG icon set. Names are semantic (threat types, UI actions).
 * No emoji, no font icons — single source for all glyphs in the app.
 */

const STROKE_PROPS = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const SOLID = new Set(['play', 'pause', 'stop']);

const PATHS = {
  // Threat archetypes
  scout: (
    <>
      <circle cx="11" cy="11" r="7.5" />
      <path d="M21 21l-4.8-4.8" />
    </>
  ),
  cargo: (
    <>
      <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
      <path d="M3.5 7.5 12 12l8.5-4.5" />
      <path d="M12 12v9" />
    </>
  ),
  kamikaze: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" />
    </>
  ),
  ewJammer: (
    <>
      <circle cx="12" cy="12" r="2" />
      <path d="M8.6 8.6a4.8 4.8 0 0 0 0 6.8M15.4 8.6a4.8 4.8 0 0 1 0 6.8M5.8 5.8a8.8 8.8 0 0 0 0 12.4M18.2 5.8a8.8 8.8 0 0 1 0 12.4" />
    </>
  ),
  decoy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="1.5" />
      <path d="M5.5 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v.5" />
    </>
  ),
  swarmNode: (
    <>
      <circle cx="7" cy="8" r="2.4" />
      <circle cx="17" cy="8" r="2.4" />
      <circle cx="12" cy="17" r="2.4" />
      <path d="M8.9 9.6l2 5.2M15.1 9.6l-2 5.2M9.4 8h5.2" />
    </>
  ),
  unidentified: (
    <>
      <circle cx="12" cy="12" r="8.5" strokeDasharray="3 3" />
      <path d="M9.3 9.4a2.9 2.9 0 1 1 4.2 2.6c-.9.5-1.5 1.1-1.5 2.1v.4" />
      <circle cx="12" cy="17.1" r="0.7" fill="currentColor" stroke="none" />
    </>
  ),

  // Navigation / pages
  shield: <path d="M12 21.5s7.5-3.8 7.5-9.5V5.5L12 2.5 4.5 5.5V12c0 5.7 7.5 9.5 7.5 9.5z" />,
  crosshair: (
    <>
      <circle cx="12" cy="12" r="7" />
      <path d="M4.5 12H2M22 12h-2.5M12 4.5V2M12 22v-2.5" />
      <circle cx="12" cy="12" r="2.2" />
    </>
  ),
  radar: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 12l6-6" />
    </>
  ),
  cube: (
    <>
      <path d="M12 2.8 20.5 7v10L12 21.2 3.5 17V7z" />
      <path d="M3.5 7 12 11.2 20.5 7" />
      <path d="M12 11.2v10" />
    </>
  ),
  chart: (
    <>
      <path d="M3.5 20.5h17" />
      <path d="M7 20.5V13M12 20.5V4.5M17 20.5V9.5" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="9" cy="6" r="1.8" />
      <circle cx="15" cy="12" r="1.8" />
      <circle cx="7" cy="18" r="1.8" />
    </>
  ),
  users: (
    <>
      <circle cx="9.5" cy="8" r="3.6" />
      <path d="M3 20.5a6.5 6.5 0 0 1 13 0" />
      <path d="M16.5 5.2a3.6 3.6 0 0 1 0 6.6" />
      <path d="M18.5 20.5a5.5 5.5 0 0 0-2.5-4.6" />
    </>
  ),
  plusSquare: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </>
  ),

  // Controls
  play: <path d="M7.5 4.8 19 12 7.5 19.2z" />,
  pause: (
    <>
      <rect x="7" y="4.8" width="3.6" height="14.4" rx="0.8" />
      <rect x="13.4" y="4.8" width="3.6" height="14.4" rx="0.8" />
    </>
  ),
  stop: <rect x="6.2" y="6.2" width="11.6" height="11.6" rx="1" />,
  refresh: (
    <>
      <path d="M21 4v6h-6" />
      <path d="M20.5 15a9 9 0 1 1-2.1-9.4L21 10" />
    </>
  ),

  // Status / actions
  check: <path d="M20 6.5 9.5 17.5 4 12" />,
  alert: (
    <>
      <path d="M10.4 4.2 2.6 17.8a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.6 4.2a2 2 0 0 0-3.2 0z" />
      <path d="M12 9.5v4.5" />
      <circle cx="12" cy="17.2" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  tag: (
    <>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
      <circle cx="7.5" cy="7.5" r="1.4" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  arrowLeft: <path d="M19 12H5M11.5 18.5 5 12l6.5-6.5" />,
  arrowRight: <path d="M5 12h14M12.5 5.5 19 12l-6.5 6.5" />,
  trendUp: (
    <>
      <path d="M21 7l-7.5 7.5-4-4L3 17" />
      <path d="M15.5 7H21v5.5" />
    </>
  ),
  trendDown: (
    <>
      <path d="M21 17l-7.5-7.5-4 4L3 7" />
      <path d="M15.5 17H21v-5.5" />
    </>
  ),
  trendFlat: (
    <>
      <path d="M4 12h16" />
      <path d="M16.5 8.5 20 12l-3.5 3.5" />
    </>
  ),
};

export default function Icon({ name, size = 16, className = '', style, title }) {
  const body = PATHS[name];
  if (!body) return null;
  const solid = SOLID.has(name);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`icon ${className}`.trim()}
      style={style}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      {...(solid ? { fill: 'currentColor' } : STROKE_PROPS)}
    >
      {title ? <title>{title}</title> : null}
      {body}
    </svg>
  );
}
