// Use the newest device report for each user; never infer Out from missing data.
export function distanceMeters(lat, lon, centerLat, centerLon) {
  const radians = value => value * Math.PI / 180;
  const a = Math.sin(radians(lat - centerLat) / 2) ** 2 +
    Math.cos(radians(lat)) * Math.cos(radians(centerLat)) *
    Math.sin(radians(lon - centerLon) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

function validNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function userPresence(records, config, now = Date.now()) {
  const users = new Map();
  for (const record of records) {
    if (!record || typeof record.username !== 'string' || !record.username ||
        (record.username === 'ping' && record.device === 'ping')) continue;
    const previous = users.get(record.username);
    const timestamp = validNumber(record.tst) ? record.tst : -Infinity;
    const previousTimestamp = previous && validNumber(previous.tst) ? previous.tst : -Infinity;
    if (!previous || timestamp > previousTimestamp) users.set(record.username, record);
  }
  return [...users.values()].sort((a, b) => a.username.localeCompare(b.username)).map(record => {
    const coordinatesValid = validNumber(record.lat) && Math.abs(record.lat) <= 90 &&
      validNumber(record.lon) && Math.abs(record.lon) <= 180;
    const timestampValid = validNumber(record.tst) && record.tst > 0 && record.tst * 1000 <= now + 60000;
    const stale = timestampValid && now - record.tst * 1000 > config.staleAfterMinutes * 60000;
    const distance = coordinatesValid ? distanceMeters(record.lat, record.lon, config.latitude, config.longitude) : null;
    const atHome = Array.isArray(record.inregions)
      ? record.inregions.includes(config.homeWaypoint)
      : distance !== null && distance <= config.radiusMeters;
    const status = !coordinatesValid || !timestampValid || stale ? 'Unknown' : atHome ? 'In' : 'Out';
    return { ...record, distance, status, stale, timestampValid };
  });
}

// Each named region keeps its own most recent report time, including overlaps.
export function lastWaypoints(records, now = Date.now()) {
  const visits = new Map();
  for (const record of records) {
    if (!validNumber(record.tst) || record.tst <= 0 || record.tst * 1000 > now + 60000 ||
        !Array.isArray(record.inregions)) continue;
    for (const name of record.inregions) {
      if (typeof name !== 'string' || !name.trim()) continue;
      if (!visits.has(name) || record.tst > visits.get(name)) visits.set(name, record.tst);
    }
  }
  return [...visits].map(([name, tst]) => ({name, tst}))
    .sort((a, b) => b.tst - a.tst || a.name.localeCompare(b.name));
}
