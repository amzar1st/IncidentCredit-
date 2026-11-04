import './style.css';
import { address, demo, explorer, readReceipt, readRecord, receiptState } from './chain.js';

const byId = id => document.getElementById(id);
const make = (tag, text) => Object.assign(document.createElement(tag), { textContent: text });
const pretty = value => String(value).replaceAll('_', ' ');
const errorText = error => error.shortMessage || error.message;
byId('contract').href = `${explorer}/address/${address}`;

function renderClaim(claim, policy) {
  const area = byId('record');
  area.append(make('h3', `${policy.service} · ${claim.region}`));
  area.append(make('p', `${claim.incident} · ${pretty(claim.status)} · ${policy.currency}`));
  if (claim.status !== 'FINALIZED') {
    area.append(make('p', `Current deadline: ${new Date(claim.deadline * 1000).toUTCString()}`));
  }
  for (const [index, review] of claim.reviews.entries()) {
    const card = make('article', '');
    card.className = 'finding';
    const final = claim.status === 'FINALIZED' && index === claim.reviews.length - 1;
    card.append(make('strong', `${final ? 'Final' : `Review ${index + 1}`} · ${pretty(review.outcome)}`));
    card.append(make('p', `${pretty(review.reason)} · ${review.seconds}s · ${review.credit_minor} ${policy.currency} minor units`));
    card.append(make('p', `Decision SHA-256: ${review.decision_sha256}`));
    for (const item of review.evidence) {
      const url = new URL(item.url);
      if (url.origin !== 'https://raw.githubusercontent.com') continue;
      const link = make('a', item.url);
      Object.assign(link, { href: url.href, target: '_blank', rel: 'noopener noreferrer' });
      const evidence = make('div', '');
      evidence.append(link, make('p', `${pretty(item.status)} · Expected SHA-256: ${item.expected_sha256}`));
      if (item.observed_sha256) evidence.append(make('p', `Observed SHA-256: ${item.observed_sha256}`));
      card.append(evidence);
    }
    area.append(card);
  }
  const details = make('details', '');
  details.append(make('summary', 'Show raw claim and immutable policy'), make('pre', JSON.stringify({ claim, policy }, null, 2)));
  area.append(details);
}
let lookupRun = 0;
async function lookup(kind, id) {
  const run = ++lookupRun;
  byId('lookup').elements.id.value = id;
  byId('record').replaceChildren();
  byId('read-status').textContent = 'Reading finalized StudioNet state…';
  try {
    const data = await readRecord(kind, id);
    const policy = kind === 'claim' ? await readRecord('policy', data.policy_id) : data;
    if (run !== lookupRun) return;
    if (kind === 'claim') renderClaim(data, policy);
    else byId('record').append(make('pre', JSON.stringify(policy, null, 2)));
    byId('read-status').textContent = `Verified from StudioNet · ${kind} ${id}`;
  } catch (error) {
    if (run === lookupRun) byId('read-status').textContent = `Lookup failed. ${errorText(error)}`;
  }
}
for (const [region, id] of Object.entries(demo)) byId(region).onclick = () => lookup('claim', id);
byId('lookup').onsubmit = event => {
  event.preventDefault();
  lookup(event.submitter?.name === 'policy' ? 'policy' : 'claim', event.currentTarget.elements.id.value);
};

const hex = count => `[0-9a-f]{${count}}`;
const claimId = ['claim_id', 'Claim ID', hex(64)];
const revision = ['revision', 'Evidence commit SHA', hex(40)];
const checksum = ['sha256', 'Evidence SHA-256', hex(64)];
const token = '[a-z0-9](?:[a-z0-9]|-){0,47}';
const number = '[0-9]{1,12}';
const actions = {
  open_claim: [['policy_id', 'Policy ID', hex(64)], ['incident', 'Incident slug', token],
    ['region', 'Region slug', token], ['start', 'Start (Unix seconds)', number],
    ['end', 'End (Unix seconds)', number], revision, checksum],
  review: [claimId],
  challenge: [claimId, revision, checksum],
  finalize: [claimId],
  register_policy: [['customer', 'Customer account', '0x[0-9a-fA-F]{40}'], ['service', 'Service slug', token],
    ['regions', 'Regions (comma-separated)', '.+'], ['report_repo', 'Primary GitHub owner/repo', '.+'],
    ['review_repo', 'Challenge GitHub owner/repo', '.+'], ['currency', 'Currency code', '[A-Z]{3}'],
    ['minimum_seconds', 'Minimum seconds', number], ['hourly_minor', 'Hourly credit (minor units)', number],
    ['cap_minor', 'Credit cap (minor units)', number], ['exclude_maintenance', 'Exclude maintenance', 'true|false'],
    ['challenge_seconds', 'Challenge window (seconds)', number]],
};

const select = byId('action');
for (const action of Object.keys(actions)) select.add(new Option(pretty(action), action));
function showFields() {
  byId('prepared').hidden = true;
  byId('fields').replaceChildren(...actions[select.value].map(([name, title, pattern]) => {
    const label = make('label', title);
    const input = Object.assign(make('input', ''), { name, required: true, pattern, maxLength: 200 });
    if (pattern === number) input.inputMode = 'numeric';
    label.append(input);
    return label;
  }));
}
select.onchange = showFields;
showFields();
byId('prepare').onsubmit = event => {
  event.preventDefault();
  const values = new FormData(event.currentTarget);
  byId('args').textContent = [select.value, ...actions[select.value].map(([name]) => `${name}: ${values.get(name)}`)].join('\n');
  byId('prepared').hidden = false;
  byId('copy-status').textContent = '';
};
byId('copy').onclick = async () => {
  try {
    await navigator.clipboard.writeText(byId('args').textContent);
    byId('copy-status').textContent = 'Arguments copied.';
  } catch {
    byId('copy-status').textContent = 'Clipboard unavailable. Select and copy the arguments above.';
  }
};

let trackingRun = 0;
byId('receipt').onsubmit = async event => {
  event.preventDefault();
  const run = ++trackingRun;
  const hash = event.currentTarget.elements.hash.value;
  const link = byId('tx-link');
  const status = byId('tx-status');
  link.href = `${explorer}/tx/${hash}`;
  link.hidden = false;
  status.textContent = 'Looking up receipt…';
  for (let attempt = 0; attempt < 36 && run === trackingRun; attempt++) {
    try {
      const state = receiptState(await readReceipt(hash));
      if (run !== trackingRun) return;
      status.textContent = state.message;
      if (state.terminal) return;
    } catch (error) {
      if (run !== trackingRun) return;
      status.textContent = `Receipt unavailable. Retrying… ${errorText(error)}`;
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  if (run === trackingRun) status.textContent = 'Tracking paused. Submit the same hash to check again.';
};
