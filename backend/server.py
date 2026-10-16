"""
DCATS — backend/server.py
Local model API server (optional, offline fallback exists in-browser).
Run:  cd backend && uvicorn server:app --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title='DCATS Model Server', version='1.0.0')
app.add_middleware(
    CORSMiddleware,
    # Local training/demo server — anything may call it, no credentials.
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)

CLASSES = ['scout', 'cargo', 'kamikaze', 'ewJammer', 'decoy', 'swarmNode']


class TrackFeatures(BaseModel):
    speed: float = 20.0
    signature: float = 0.05  # RCS in m^2 (alias: rcs)
    rcs: float | None = None
    altitude: float = 100.0
    vx: float = 0.0
    vy: float = 0.0


def heuristic(features: TrackFeatures) -> dict:
    # Decision boundaries mirror the shipped in-browser heuristic
    # (src/ai/classifier.js heuristicClassify) so both backends agree on
    # every class — including decoy, which the envelopes make distinguishable
    # from cargo by speed.
    speed = features.speed
    rcs = features.rcs if features.rcs is not None else features.signature
    z = features.altitude
    # Tiny-RCS first: swarm nodes overlap the kamikaze speed band
    # (both can fly at 40-45 m/s), but not its RCS envelope.
    if rcs <= 0.007:
        pred, conf = 'swarmNode', 79
    elif speed >= 40:
        pred, conf = 'kamikaze', 88
    elif rcs >= 0.08:
        pred, conf = ('cargo', 74) if speed <= 20 else ('decoy', 72)
    elif rcs >= 0.062:
        pred, conf = 'decoy', 75
    elif rcs >= 0.03:
        pred, conf = 'ewJammer', 68
    else:
        pred, conf = 'scout', 69
    return {
        'class': pred,
        'confidence': conf,
        'features': {'speed': speed, 'rcs': rcs, 'altitude': z},
        'explanation': (
            f'speed={speed}m/s, RCS={rcs}m^2, altitude={z}m '
            f'-> {pred} ({conf}% confidence)'
        ),
    }


@app.get('/health')
def health():
    return {'status': 'ok', 'service': 'dcats-model-server'}


@app.post('/predict')
def predict(f: TrackFeatures):
    return heuristic(f)


@app.get('/scenarios')
def scenarios():
    import json
    from pathlib import Path
    out = []
    for p in sorted((Path(__file__).parent.parent / 'data' / 'scenarios').glob('*.json')):
        out.append(json.loads(p.read_text()))
    return out
