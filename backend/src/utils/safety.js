const { haversineDistance } = require('./fare');

/**
 * Maximum allowed perpendicular deviation from the straight-line
 * pickup→dropoff corridor before flagging a route deviation (km).
 */
const DEVIATION_THRESHOLD_KM = 1.5;

const toXYMeters = ([lng, lat], refLatRad) => {
  const R = 6371000;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  return {
    x: lngRad * Math.cos(refLatRad) * R,
    y: latRad * R,
  };
};

const pointToSegmentDistanceMeters = (p, a, b) => {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;

  const abLen2 = abx * abx + aby * aby;
  if (abLen2 === 0) return Math.hypot(apx, apy);

  let t = (apx * abx + apy * aby) / abLen2;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * abx;
  const projY = a.y + t * aby;
  return Math.hypot(p.x - projX, p.y - projY);
};

const minDistancePointToLineKm = (point, lineCoords) => {
  if (!Array.isArray(lineCoords) || lineCoords.length < 2) return Number.POSITIVE_INFINITY;
  const refLatRad = (point[1] * Math.PI) / 180;
  const p = toXYMeters(point, refLatRad);
  let min = Number.POSITIVE_INFINITY;

  for (let i = 0; i < lineCoords.length - 1; i++) {
    const a = toXYMeters(lineCoords[i], refLatRad);
    const b = toXYMeters(lineCoords[i + 1], refLatRad);
    const d = pointToSegmentDistanceMeters(p, a, b);
    if (d < min) min = d;
  }

  return min / 1000;
};

/**
 * Checks whether a given coordinate deviates significantly from the
 * straight-line corridor between pickup and dropoff.
 *
 * Uses the cross-track distance formula (great-circle geometry).
 * Returns { deviated: bool, deviationKm: number }
 */
const checkRouteDeviation = (currentCoords, pickupCoords, dropoffCoords, plannedRouteCoords = null) => {
  if (
    Array.isArray(plannedRouteCoords) &&
    plannedRouteCoords.length >= 2 &&
    plannedRouteCoords.every((c) => Array.isArray(c) && c.length === 2)
  ) {
    const endpoint = plannedRouteCoords[plannedRouteCoords.length - 1];
    const dToEnd = haversineDistance(currentCoords, endpoint);
    if (dToEnd < 0.1) return { deviated: false, deviationKm: 0 };

    const deviationKm = minDistancePointToLineKm(currentCoords, plannedRouteCoords);
    const rounded = parseFloat(deviationKm.toFixed(2));
    return {
      deviated: rounded > DEVIATION_THRESHOLD_KM,
      deviationKm: rounded,
    };
  }

  // Distances: pickup→current, pickup→dropoff
  const dAC = haversineDistance(pickupCoords, currentCoords);
  const dAB = haversineDistance(pickupCoords, dropoffCoords);
  const dBC = haversineDistance(currentCoords, dropoffCoords);

  // If driver is past the dropoff, no deviation concern
  if (dBC < 0.1) return { deviated: false, deviationKm: 0 };

  // Cross-track distance via Heron's formula (approximate for short distances)
  const s = (dAC + dBC + dAB) / 2;
  const area = Math.sqrt(Math.max(0, s * (s - dAC) * (s - dBC) * (s - dAB)));
  const deviationKm = dAB > 0 ? (2 * area) / dAB : dAC;

  return {
    deviated:    deviationKm > DEVIATION_THRESHOLD_KM,
    deviationKm: parseFloat(deviationKm.toFixed(2)),
  };
};

/**
 * Compute a safety score (0–100) for a user based on their event history.
 *
 * Scoring:
 *   Start at 100.
 *   Each SOS triggered by others against this user:  -20
 *   Each FLAG (HIGH/CRITICAL severity):              -15
 *   Each FLAG (LOW/MEDIUM severity):                 -8
 *   Each ROUTE_DEVIATION:                            -5
 *   Each SUSPICIOUS_CANCEL:                          -3
 *   Floor at 0.
 */
const computeSafetyScore = (events) => {
  let score = 100;
  const breakdown = { sos: 0, flagHigh: 0, flagLow: 0, deviation: 0, suspiciousCancel: 0 };

  for (const e of events) {
    switch (e.type) {
      case 'SOS':
        score -= 20; breakdown.sos++;
        break;
      case 'FLAG_DRIVER':
      case 'FLAG_PASSENGER':
        if (['HIGH', 'CRITICAL'].includes(e.severity)) { score -= 15; breakdown.flagHigh++; }
        else                                            { score -= 8;  breakdown.flagLow++;  }
        break;
      case 'ROUTE_DEVIATION':
        score -= 5; breakdown.deviation++;
        break;
      case 'SUSPICIOUS_CANCEL':
        score -= 3; breakdown.suspiciousCancel++;
        break;
    }
  }

  return { score: Math.max(0, score), breakdown };
};

module.exports = { checkRouteDeviation, computeSafetyScore, DEVIATION_THRESHOLD_KM };
