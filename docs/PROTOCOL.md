# Protocol and evidence

A provider registers an immutable policy for a named customer address. The policy binds the service, covered regions, two GitHub publisher accounts, currency, minimum duration, hourly rate, cap, maintenance exclusion and challenge period. A customer accepts the policy for a claim by opening against its ID. The contract prevents duplicate submissions for the same policy, incident and region.

The contract fetches only `incident.json` from `raw.githubusercontent.com` in the chosen publisher repository at a full commit SHA. A digest supplied with the reference must match the fetched bytes. For example:

```json
{
  "schema": "incidentcredit/1",
  "incident": "edge-incident-01",
  "service": "edge-api",
  "regions": {
    "us-east": { "status": "OUTAGE", "start": 1767225600, "end": 1767231000 },
    "eu-west": { "status": "UNAFFECTED" }
  }
}
```

The third recognized region status is `SCHEDULED_MAINTENANCE`. Publish only public, completed outage windows in UTC Unix seconds. Evidence is limited to 16 KiB after retrieval and 32 region entries. Text and unknown fields have no effect. A status-page provider or monitoring service can publish this snapshot format from its existing incident records. The contract verifies the exact published bytes and their scope. It relies on the policy parties to choose authoritative repositories. Separate GitHub account names do not prove independent ownership, and the contract does not authenticate off-chain customer identity.

## Lifecycle

1. Provider calls `register_policy`. Copy the printed ID from GenVM logs.
2. The nominated customer calls `open_claim`. The request contains one report reference and a bounded window of up to seven days.
3. Anyone calls `review` within 24 hours. Validators independently fetch and normalize the exact same inputs and compare canonical results through strict equivalence.
4. Either party can call `challenge` once, before the policy deadline. This references a snapshot from the second locked repository. Anyone can re-review within 24 hours.
5. Anyone calls `finalize` once a reviewed claim passes the challenge deadline, after re-review, or after an expired review deadline. An expired review becomes inconclusive.

Invalid reports are logged separately and cannot veto a valid report. Two valid contradictory findings produce an inconclusive result. No usable report also produces an inconclusive result. The credit uses the overlap of the claim and evidence windows and is rounded down in minor units, then capped. An unaffected region, an applicable maintenance exclusion, or an interval below the minimum is denied. The decision digest binds the claim ID, review index and canonical finding including evidence. Each claim concerns one reported interval. Aggregation, invoice settlement, evidence-source onboarding and incident deduplication across different incident IDs are external to this MVP. Use final credits as billing review records.

## Studio signing

Open the [deployed contract in Studio](https://studio.genlayer.com/?import-contract=0x6Ea406Bd157Fe1931A28117Db69A4F508Ff53E44), select an account in the Studio header, and use **Run and Debug → Write Methods**. The dashboard shows the exact arguments to enter. Copy the submitted transaction hash into the dashboard's receipt tracker. Built-in Studio accounts belong to the Studio origin, so signing happens there while the dashboard verifies the receipt and finalized state through the public RPC. Do not share private keys.

[Official Studio transaction guide](https://docs.genlayer.com/developers/intelligent-contracts/tools/genlayer-studio/execute-transaction)
