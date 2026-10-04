"""Fit the header growth model per template from tmp/calib/measure.json.

mainTop(profile) ~ base + rowMm * rows + lineMm * wrapLines + titleMm * (titleLines - 1) + nameMm * (nameLines - 1)
rows = ceil(n / cols); wrapLines = sum(ceil(len / L) - 1); titleLines = ceil(len(title) / Lt); nameLines = ceil(len(name) / Ln)
Only profiles without a photo are used for the text stack (a photo is a floor handled by top1).
"""
import json, math, itertools
import numpy as np

def nnls(A, b, iters=200):
    # Lawson-Hanson active set
    m, n = A.shape
    P = []
    x = np.zeros(n)
    w = A.T @ (b - A @ x)
    for _ in range(iters):
        R = [j for j in range(n) if j not in P]
        if not R or max(w[R]) <= 1e-9: break
        j = R[int(np.argmax(w[R]))]
        P.append(j)
        while True:
            z = np.zeros(n)
            sol, *_ = np.linalg.lstsq(A[:, P], b, rcond=None)
            z[P] = sol
            if all(z[P] > 1e-12):
                x = z
                break
            neg = [k for k in P if z[k] <= 1e-12]
            alpha = min(x[k] / (x[k] - z[k]) for k in neg)
            x = x + alpha * (z - x)
            P = [k for k in P if x[k] > 1e-12]
        w = A.T @ (b - A @ x)
    return x, None


rows = json.load(open('tmp/calib/measure.json'))
ids = sorted({r['id'] for r in rows})
result = {}

def title_lines(r, Lt):
    return math.ceil(r['title'] / Lt) if r['title'] else 0

def grid(r, cols, L):
    items = [math.ceil(c / L) for c in r['contacts']]
    rows = [items[i:i + cols] for i in range(0, len(items), cols)]
    return len(rows), sum(max(row) for row in rows)

def flow(r, C, over):
    lines, used = 0, 0
    for c in r['contacts']:
        w = c + over
        if used == 0:
            lines += 1; used = w
        elif used + w <= C:
            used += w
        else:
            lines += 1; used = w
        while used > C:
            lines += 1; used -= C
    return lines, lines

def features(r, kind, a, b, Lt, Ln):
    nrows, nlines = grid(r, a, b) if kind == 'grid' else flow(r, a, b)
    t = title_lines(r, Lt)
    name = math.ceil(r['name'] / Ln)
    return [1.0, nrows, nlines, max(0, t - 1), 1.0 if r['title'] else 0.0, max(0, name - 1)]

for tid in ids:
  for photo in [False, True]:
    for target0 in ['main', 'side']:
        target = target0
        key = target0 + ('Photo' if photo else '')
        data = [r for r in rows if r['id'] == tid and r['photo'] == photo and r[target] is not None]
        if len(data) < 10:
            continue
        y = np.array([r[target] for r in data])
        if y.max() - y.min() < 1.0:
            result.setdefault(tid, {})[key] = {'constant': float(y.max())}
            continue
        best = None
        options = [('grid', c, L) for c in [1, 2, 3] for L in [16, 20, 24, 28, 32, 36, 42, 50, 60, 75, 95]] + [('flow', C, o) for C in [60, 80, 100, 120, 140, 170, 200, 240] for o in [2, 4, 6, 9]]
        for (kind, a, b), Lt, Ln in itertools.product(options, [28, 36, 44, 52, 60, 70, 80, 95], [14, 18, 22, 26, 32, 40]):
            X = np.array([features(r, kind, a, b, Lt, Ln) for r in data])
            coef, _ = nnls(X, y)
            err = y - X @ coef
            score = err.max() + 0.3 * np.abs(err).mean()
            if best is None or score < best[0]:
                best = (score, kind, a, b, Lt, Ln, coef, err)
        score, kind, a, b, Lt, Ln, coef, err = best
        result.setdefault(tid, {})[key] = {
            'kind': kind, 'a': a, 'b': b, 'Lt': Lt, 'Ln': Ln,
            'base': round(float(coef[0]), 2), 'row': round(float(coef[1]), 2), 'line': round(float(coef[2]), 2),
            'title': round(float(coef[3]), 2), 'hasTitle': round(float(coef[4]), 2), 'name': round(float(coef[5]), 2),
            'under': round(float(err.max()), 2), 'over': round(float(-err.min()), 2), 'range': [round(float(y.min()), 1), round(float(y.max()), 1)],
        }
    print(tid, json.dumps(result.get(tid)), flush=True)
json.dump(result, open('tmp/calib/fit.json', 'w'), indent=1)
