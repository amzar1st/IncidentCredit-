import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { TransactionHashVariant } from 'genlayer-js/types';

export const address = '0x6Ea406Bd157Fe1931A28117Db69A4F508Ff53E44';
export const explorer = 'https://explorer-studio.genlayer.com';
export const demo = {
  east: '95082d1c77cd2af6e412f687c24074380ecf7b23fc6f4f7d1637e986b1bd1889',
  west: '3b25579cbf8191da1a0704624fc9553e57655b70910b95810710230bdb01dc0e',
};

export function receiptState(tx) {
  const status = tx.statusName ?? tx.status ?? 'UNKNOWN';
  const leader = tx.consensus_data?.leader_receipt?.find?.(entry => entry.mode === 'leader');
  const execution = tx.txExecutionResultName ?? tx.txExecutionResult ?? leader?.execution_result;
  if (status === 'FINALIZED' && (execution === 'FINISHED_WITH_RETURN' || execution === 1 || execution === 'SUCCESS')) {
    return { terminal: true, message: 'Finalized successfully.' };
  }
  if (status === 'FINALIZED') {
    return { terminal: true, message: execution === 'FINISHED_WITH_ERROR' || execution === 2 || execution === 'ERROR'
      ? 'Finalized with a contract error.' : 'Finalized. Successful execution could not be verified.' };
  }
  if (['CANCELED', 'UNDETERMINED'].includes(status)) {
    return { terminal: true, message: `Transaction did not finalize successfully (${status}).` };
  }
  return { terminal: false, message: `Awaiting finalization · ${status}` };
}

const client = createClient({ chain: studionet });
export async function readRecord(kind, id) {
  if (!['claim', 'policy'].includes(kind) || !/^[0-9a-f]{64}$/.test(id)) throw new Error('Invalid lookup.');
  const value = await client.readContract({
    address, functionName: `get_${kind}`, args: [id],
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
  });
  if (typeof value !== 'string') throw new Error('Unexpected contract response.');
  return JSON.parse(value);
}
export const readReceipt = hash => client.getTransaction({ hash });
