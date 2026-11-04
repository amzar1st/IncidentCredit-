import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { address, demo, readRecord, readReceipt } from '../web/chain.js';

const evidence = JSON.parse(await readFile(new URL('../evidence/studionet.json', import.meta.url), 'utf8'));
const client = createClient({ chain: studionet });
assert.equal(studionet.id, evidence.chainId);
assert.equal(address, evidence.address);
const sha256 = data => createHash('sha256').update(data).digest('hex');
const remoteCode = await client.getContractCode(address);
const deployedCode = remoteCode.startsWith('0x') ? Buffer.from(remoteCode.slice(2), 'hex') : remoteCode;
assert.equal(sha256(deployedCode), evidence.sourceSha256);
assert.equal(sha256(await readFile(new URL('../contracts/incident_credit.py', import.meta.url))), evidence.sourceSha256);

for (const [name, hash] of Object.entries(evidence.transactions)) {
  const tx = await readReceipt(hash);
  assert.equal(tx.statusName, 'FINALIZED', name);
  if (name !== 'upgrade') {
    const leader = tx.consensus_data.leader_receipt.find(entry => entry.mode === 'leader');
    assert.equal(leader.execution_result, name === 'failed_review' ? 'ERROR' : 'SUCCESS', name);
  }
  console.log(name, tx.statusName, hash);
}

const policy = await readRecord('policy', evidence.ids.policy);
assert.equal(policy.currency, 'USD');
for (const [region, expected] of Object.entries({ east: ['QUALIFIED', 1500], west: ['DENIED', 0] })) {
  assert.equal(demo[region], evidence.ids[region]);
  const claim = await readRecord('claim', demo[region]);
  const decision = claim.reviews.at(-1);
  assert.equal(claim.status, 'FINALIZED');
  assert.equal(claim.policy_id, evidence.ids.policy);
  assert.deepEqual([decision.outcome, decision.credit_minor], expected);
  assert.equal(decision.evidence[0].status, 'VALID');
  if (region === 'east') {
    assert.equal(claim.reviews.length, 2);
    assert.equal(decision.evidence[1].status, 'UNAVAILABLE');
  }
  console.log(region, decision.outcome, decision.credit_minor, decision.decision_sha256);
}
