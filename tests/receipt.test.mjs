import { test } from 'node:test';
import assert from 'node:assert/strict';
import { receiptState } from '../web/chain.js';

test('accepted state remains pending', () => {
  assert.equal(receiptState({ statusName: 'ACCEPTED', txExecutionResult: 1 }).terminal, false);
});
test('explicit finalized success', () => {
  assert.match(receiptState({ statusName: 'FINALIZED', txExecutionResult: 1 }).message, /successfully/);
});
test('StudioNet leader receipt distinguishes success from contract failure', () => {
  const tx = { statusName: 'FINALIZED', consensus_data: { leader_receipt: [{ mode: 'leader', result: { status: 'return' }, execution_result: 'SUCCESS' }] } };
  assert.match(receiptState(tx).message, /successfully/);
  tx.consensus_data.leader_receipt[0].execution_result = 'ERROR';
  assert.match(receiptState(tx).message, /contract error/);
});
test('finalized without execution evidence is unknown', () => {
  assert.match(receiptState({ statusName: 'FINALIZED' }).message, /could not be verified/);
});
test('cancelation terminates tracking', () => {
  assert.equal(receiptState({ statusName: 'CANCELED' }).terminal, true);
});
