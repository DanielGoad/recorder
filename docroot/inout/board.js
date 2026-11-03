import config from './config.js';
import { userPresence, lastWaypoints } from './presence.js';

const body = document.querySelector('#users');
const notice = document.querySelector('#notice');
const button = document.querySelector('#refresh');
document.querySelector('#home').search = window.location.search;
document.querySelector('#description').textContent =
  `In means at ${config.homeWaypoint}. Updates every ${config.refreshSeconds} seconds. Reports older than ${config.staleAfterMinutes} minutes show Unknown. Waypoint history covers the last ${config.historyDays} days for the selected device.`;

function apiUrl(endpoint) {
  const url = new URL('../api/0/' + endpoint, window.location.href);
  const scope = new URLSearchParams(window.location.search);
  for (const key of ['user', 'device']) {
    if (scope.has(key)) url.searchParams.set(key, scope.get(key));
  }
  return url;
}
async function read(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {cache: 'no-store', signal: controller.signal});
    if (!response.ok) throw new Error('Location request failed');
    return await response.json();
  } finally { clearTimeout(timeout); }
}
function cell(row, text) {
  const td = document.createElement('td');
  td.textContent = text;
  row.append(td);
  return td;
}
function time(tst) {
  return new Date(tst * 1000).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}
async function history(user) {
  const url = apiUrl('locations');
  url.searchParams.set('user', user.username);
  url.searchParams.set('device', user.device);
  url.searchParams.set('format', 'json');
  // Do not request fields: older Recorder versions omit arrays with that option.
  url.searchParams.set('from', new Date(Date.now() - config.historyDays * 86400000).toISOString().slice(0, 19));
  const data = await read(url);
  if (!data || !Array.isArray(data.locations)) throw new Error('Invalid history response');
  return lastWaypoints(data.locations);
}
async function refresh() {
  if (button.disabled) return;
  button.disabled = true;
  try {
    const records = await read(apiUrl('last'));
    if (!Array.isArray(records)) throw new Error('Invalid location response');
    const rows = userPresence(records, config);
    const fragment = document.createDocumentFragment();
    const pending = [];
    for (const user of rows) {
      const row = document.createElement('tr');
      const name = cell(row, user.name || user.username);
      const device = document.createElement('small');
      device.textContent = `${user.username} / ${user.device || 'Unknown device'}`;
      name.append(device);
      const status = cell(row, '');
      const badge = document.createElement('span');
      badge.className = `badge ${user.status.toLowerCase()}`;
      badge.textContent = user.status;
      status.append(badge);
      cell(row, user.timestampValid ? time(user.tst) : 'No valid report');
      const waypoints = cell(row, user.status === 'Out' ? 'Loading history…' : '');
      if (user.status === 'Out') pending.push({user, waypoints});
      fragment.append(row);
    }
    body.replaceChildren(fragment);
    notice.textContent = rows.length ? `Updated ${new Date().toLocaleTimeString()} · ${rows.length} users` : 'No users with location reports are available.';
    // Limit history requests to one at a time on low-end Recorder hardware.
    for (const {user, waypoints} of pending) {
      try {
        const visits = await history(user);
        waypoints.replaceChildren();
        for (const visit of visits) {
          const line = document.createElement('div');
          line.textContent = `${visit.name} (at ${time(visit.tst)})`;
          waypoints.append(line);
        }
        if (!visits.length) waypoints.textContent = `None reported in the last ${config.historyDays} days`;
      } catch (error) {
        waypoints.textContent = 'Waypoint history unavailable';
      }
    }
  } catch (error) {
    body.replaceChildren();
    notice.textContent = 'Locations unavailable. Check your connection or sign-in. Retrying automatically.';
  } finally { button.disabled = false; }
}
button.addEventListener('click', refresh);
refresh();
setInterval(refresh, config.refreshSeconds * 1000);
