import config from './config.js';
import { userPresence } from './presence.js';
import { getApiUrl } from '../utils/network.js';

const body = document.querySelector('#users');
const notice = document.querySelector('#notice');
const button = document.querySelector('#refresh');
document.querySelector('#home').search = window.location.search;
document.querySelector('#description').textContent =
  `In means within ${config.radiusMeters} meters of the designated location. Reports older than ${config.staleAfterMinutes} minutes show Unknown. Updates every ${config.refreshSeconds} seconds.`;

function cell(row, text) {
  const td = document.createElement('td');
  td.textContent = text;
  row.append(td);
  return td;
}

async function refresh() {
  if (button.disabled) return;
  button.disabled = true;
  try {
    const response = await fetch(getApiUrl('last', { includeSearchParams: true }), {
      cache: 'no-store', signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('Location request failed');
    const records = await response.json();
    if (!Array.isArray(records)) throw new Error('Invalid location response');
    const rows = userPresence(records, config);
    const fragment = document.createDocumentFragment();
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
      cell(row, user.timestampValid ? new Date(user.tst * 1000).toLocaleString() : 'No valid report');
      fragment.append(row);
    }
    body.replaceChildren(fragment);
    notice.textContent = rows.length ? `Updated ${new Date().toLocaleTimeString()} · ${rows.length} users` : 'No users with location reports are available.';
  } catch (error) {
    // Remove previous In/Out results rather than presenting stale presence as current.
    body.replaceChildren();
    notice.textContent = 'Locations unavailable. Check your connection or sign-in. Retrying automatically.';
  } finally {
    button.disabled = false;
  }
}
button.addEventListener('click', refresh);
refresh();
setInterval(refresh, config.refreshSeconds * 1000);
