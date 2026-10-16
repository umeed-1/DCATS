"""
DCATS — backend/model/train_model.py
Trains a RandomForest snapshot classifier on synthetic tracks sampled from
the *same per-type envelopes the simulation generates at runtime*
(src/store.js THREAT_TYPES + generateThreats) and exports it to ONNX
(public/models/threat_classifier.onnx) for in-browser inference via
onnxruntime-web.

Run:  cd backend && pip install scikit-learn skl2onnx onnx numpy && python model/train_model.py

The heuristic in src/ai/classifier.js mirrors these class boundaries so the
demo works even before training.
"""
import json
from pathlib import Path

import numpy as np

CLASSES = ['scout', 'cargo', 'kamikaze', 'ewJammer', 'decoy', 'swarmNode']

# Per-class operating envelopes — mirror src/store.js THREAT_TYPES and the
# generateThreats() sampler exactly, so the classifier trains on the same
# distributions the simulation emits at runtime:
#   speed  ~ U(speed_lo, speed_hi) m/s
#   rcs    = rcs_base × U(0.8, 1.2) m²
#   z      ~ U(50, 200) m — identical band for every type (no class signal)
#   vx, vy ~ U(-1, 1) spawn velocities (boids evolves them within speed/10)
#   aggressive = speed > 35 (the sim's manoeuvre flag)
PROFILES = {
    'scout':     {'speed': (15, 35), 'rcs': 0.010},
    'cargo':     {'speed': (8, 20),  'rcs': 0.100},
    'kamikaze':  {'speed': (40, 80), 'rcs': 0.020},
    'ewJammer':  {'speed': (10, 25), 'rcs': 0.050},
    'decoy':     {'speed': (20, 40), 'rcs': 0.080},
    'swarmNode': {'speed': (20, 45), 'rcs': 0.005},
}

FEATURES = ['speed', 'rcs', 'altitude', 'vx', 'vy', 'aggressive']


def synth_sample(cls: str, rng: np.random.Generator):
    spec = PROFILES[cls]
    lo, hi = spec['speed']
    speed = lo + rng.random() * (hi - lo)
    rcs = spec['rcs'] * (0.8 + rng.random() * 0.4)
    alt = 50.0 + rng.random() * 150.0
    vx = rng.uniform(-1.0, 1.0)
    vy = rng.uniform(-1.0, 1.0)
    aggressive = 1.0 if speed > 35 else 0.0
    return [speed, rcs, alt, vx, vy, aggressive]


def make_dataset(n_per_class: int = 2000, seed: int = 42):
    rng = np.random.default_rng(seed)
    X, y = [], []
    for i, cls in enumerate(CLASSES):
        for _ in range(n_per_class):
            X.append(synth_sample(cls, rng))
            y.append(i)
    return np.array(X, dtype=np.float32), np.array(y, dtype=np.int64)


JITTER = 0.02  # relative sensor measurement error (training augmentation + eval)


def jitter_features(X: np.ndarray, jitter: float, rng: np.random.Generator) -> np.ndarray:
    """Simulate radar measurement error: ±jitter relative noise on speed/rcs/
    altitude, plus small additive noise on the vx/vy trajectory components."""
    Xj = X.copy()
    u = rng.uniform(-1.0, 1.0, size=(len(Xj), 3))
    Xj[:, 0] *= 1.0 + jitter * u[:, 0]
    Xj[:, 1] *= 1.0 + jitter * u[:, 1]
    Xj[:, 2] *= 1.0 + jitter * u[:, 2]
    Xj[:, 3] += jitter * 10.0 * rng.uniform(-1.0, 1.0, size=len(Xj))
    Xj[:, 4] += jitter * 10.0 * rng.uniform(-1.0, 1.0, size=len(Xj))
    return Xj


def main():
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import accuracy_score, classification_report

    X, y = make_dataset()
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    rng = np.random.default_rng(7)
    # Train on a noise-augmented copy: real radar feeds carry measurement error,
    # so the cue should degrade gracefully rather than memorise exact envelopes.
    clf = RandomForestClassifier(n_estimators=300, max_depth=None, max_features=0.66,
                                 random_state=42, n_jobs=-1)
    clf.fit(jitter_features(Xtr, JITTER, rng), ytr)
    acc = accuracy_score(yte, clf.predict(Xte))
    acc_jittered = accuracy_score(yte, clf.predict(jitter_features(Xte, JITTER, rng)))
    print(f'RandomForest accuracy (nominal envelopes): {acc:.4f}')
    print(f'RandomForest accuracy (sensor jitter +/-{JITTER:.0%}): {acc_jittered:.4f}')
    print(classification_report(yte, clf.predict(Xte), target_names=CLASSES))
    importances = dict(zip(FEATURES, (clf.feature_importances_.tolist())))
    print('Feature importances:', json.dumps(importances, indent=2))

    # Export to ONNX
    from skl2onnx import convert_sklearn
    from skl2onnx.common.data_types import FloatTensorType

    onnx_model = convert_sklearn(
        clf, 'threat_classifier',
        [('input', FloatTensorType([None, len(FEATURES)]))],
        target_opset=17,
        # Ship probabilities as a plain [N, 6] tensor; the zipmap Sequence(Map)
        # form is awkward to consume in onnxruntime-web (src/ai/classifier.js).
        options={'zipmap': False},
    )
    out_dir = Path(__file__).parent.parent.parent / 'public' / 'models'
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / 'threat_classifier.onnx'
    out_path.write_bytes(onnx_model.SerializeToString())
    print(f'Saved ONNX model -> {out_path} ({out_path.stat().st_size / 1024:.1f} KB)')

    meta = {'classes': CLASSES, 'features': FEATURES,
            'accuracy': acc, 'accuracy_jittered': acc_jittered,
            'jitter': JITTER, 'n_estimators': 300, 'n_samples': int(len(X)),
            'importances': importances}
    (out_dir / 'threat_classifier.meta.json').write_text(json.dumps(meta, indent=2))


if __name__ == '__main__':
    main()
