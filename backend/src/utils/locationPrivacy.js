const round6 = (n) => Math.round(Number(n) * 1e6) / 1e6;

const hashInt = (input) => {
  const s = String(input || 'ride');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
};

const offsetCoordinates = (coords, seed, minMeters = 80, maxMeters = 160) => {
  if (!Array.isArray(coords) || coords.length !== 2) return null;

  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

  const h1 = hashInt(`${seed}:a`);
  const h2 = hashInt(`${seed}:b`);

  const angleRad = ((h1 % 360) * Math.PI) / 180;
  const distanceMeters = minMeters + (h2 % (maxMeters - minMeters + 1));

  const metersPerDegLat = 111320;
  const metersPerDegLng = Math.max(1, metersPerDegLat * Math.cos((lat * Math.PI) / 180));

  const deltaLat = (distanceMeters * Math.cos(angleRad)) / metersPerDegLat;
  const deltaLng = (distanceMeters * Math.sin(angleRad)) / metersPerDegLng;

  return {
    coordinates: [round6(lng + deltaLng), round6(lat + deltaLat)],
    offsetMeters: distanceMeters,
  };
};

const obfuscateRidePickup = (ride, seed) => {
  if (!ride?.pickup?.coordinates?.coordinates) return ride;

  const baseSeed = seed || ride._id || ride.id || ride.driverId || 'ride';
  const shifted = offsetCoordinates(ride.pickup.coordinates.coordinates, baseSeed);
  if (!shifted) return ride;

  return {
    ...ride,
    pickup: {
      ...ride.pickup,
      coordinates: {
        ...ride.pickup.coordinates,
        coordinates: shifted.coordinates,
      },
      isApproximate: true,
      locationPrivacy: {
        exactHidden: true,
        offsetMeters: shifted.offsetMeters,
      },
    },
  };
};

module.exports = {
  offsetCoordinates,
  obfuscateRidePickup,
};
