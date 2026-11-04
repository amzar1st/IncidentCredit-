# Live verification

Network: GenLayer StudioNet, chain 61999. All deployment, upgrade and demo writes used the built-in Studio accounts in full-consensus mode. The registered provider and nominated customer were distinct.

- [Open dashboard](https://incidentcredit.tinymule33.chatgpt.site/)
- [Open deployed contract in Studio](https://studio.genlayer.com/?import-contract=0x6Ea406Bd157Fe1931A28117Db69A4F508Ff53E44)
- [View contract in StudioNet Explorer](https://explorer-studio.genlayer.com/address/0x6Ea406Bd157Fe1931A28117Db69A4F508Ff53E44)
- [Current source-matched contract](https://github.com/amzar1st/IncidentCredit-/blob/95108631c55b053fba6609434f7bcf45691c80ae/contracts/incident_credit.py)
- [Machine-readable addresses, claim IDs and transactions](../evidence/studionet.json)

The deployed source returned by `getContractCode` matches the current contract byte for byte. SHA-256: `6b77be36901273ca689089c8ab3667805153da3a99864bb6f0fd3326bb249ac9`. The instance was upgraded in place to accommodate the pinned GenVM web response API. The original deployment and the upgrade are separate receipts.

## Finalized demonstration

This is a **synthetic partial outage**. The primary fixture is [public and commit-pinned](https://raw.githubusercontent.com/amzar1st/IncidentCredit-/4b4fd3d61f66749c5fc261d13baa40cce205baac/incident.json). It describes an edge API outage in US East for 5,400 seconds and explicitly identifies EU West as unaffected. The policy sets a 900-second minimum, USD 1,000 minor units per hour and a USD 3,000 minor-unit cap.

| Region | Final outcome | Credit | Final decision SHA-256 |
| --- | --- | ---: | --- |
| US East | QUALIFIED | $15.00 | `02d6e4d73634ef52684c851dcb9af62dc4e27f9776bf36614ea1cff1acb3f44e` |
| EU West | DENIED, region unaffected | $0.00 | `f55ab08a7ac4e66fa37c325446ee0aa76148bfc6b9c9d49aaadaaed8c587fc8d` |

The US East challenge intentionally points to an unavailable counter-report. The re-review records `UNAVAILABLE` separately and keeps the valid primary finding. A valid contradictory counter-report is covered by the automated tests and returns `INCONCLUSIVE`.

## Transactions

| Step | Explorer receipt | Verified result |
| --- | --- | --- |
| deploy | [`0x991c7f393a0c…`](https://explorer-studio.genlayer.com/tx/0x991c7f393a0cbaebd18b64ca9b72bc999e7995636b7adb1425bc6a89f58c91e1) | Finalized, execution successful |
| policy | [`0xc49807e963e9…`](https://explorer-studio.genlayer.com/tx/0xc49807e963e926fb22e2c5db72e4d0e8173e3fa9b070944b30480701805db51f) | Finalized, execution successful |
| open east | [`0x3672b07be502…`](https://explorer-studio.genlayer.com/tx/0x3672b07be50283bededb3e70a4be4c481977d56edd3c983ec79c21ef0c70d6a3) | Finalized, execution successful |
| open west | [`0x8e4ba26aa603…`](https://explorer-studio.genlayer.com/tx/0x8e4ba26aa60377e715239b9cad18c390e013646a4a244c8ab35217ffd2cb5c5a) | Finalized, execution successful |
| failed review | [`0xc04c0e1e55de…`](https://explorer-studio.genlayer.com/tx/0xc04c0e1e55de79d79a0edb98a431c43f995b0c8067315ef67e0c5425ecd10b44) | Finalized, contract error |
| upgrade | [`0xaaba3d0d38f0…`](https://explorer-studio.genlayer.com/tx/0xaaba3d0d38f0fd496d3f8a384711b378d2ed00d54f4e4b32a844cd14cc804729) | Finalized, current code hash verified |
| review east | [`0x2774ed00bd9d…`](https://explorer-studio.genlayer.com/tx/0x2774ed00bd9d3992a067286d5f5920d28f83e49382daecd14da2a0d568237cd6) | Finalized, execution successful |
| challenge east | [`0x20dc1b221b0c…`](https://explorer-studio.genlayer.com/tx/0x20dc1b221b0c4cceeffa5fecbd2e9980118df7471b8d46023b82eaaa521b200b) | Finalized, execution successful |
| review west | [`0xa6fb0066d98c…`](https://explorer-studio.genlayer.com/tx/0xa6fb0066d98c2535d32ce0c228eb56a28424fb69144e315fa9c25499219cca02) | Finalized, execution successful |
| rereview east | [`0xc35855133e1c…`](https://explorer-studio.genlayer.com/tx/0xc35855133e1ca3743b73b2d40ef5091f37620a69b6e828ee8b2ec4355e126ec5) | Finalized, execution successful |
| finalize east | [`0x4d83a380f49a…`](https://explorer-studio.genlayer.com/tx/0x4d83a380f49a3215d9d62d96005c138bc55fe5815869d3c119f55c36ffaa686d) | Finalized, execution successful |
| finalize west | [`0x1da35d493340…`](https://explorer-studio.genlayer.com/tx/0x1da35d493340f7d0770cd8e1f2e22485ae9eb0ab9e50a0cde1e830e0e355f24d) | Finalized, execution successful |

## Reproduce the checks

```sh
npm ci
npm test
npm run build
node scripts/verify-live.mjs
```

The live script asserts the source hash, every receipt's finalization, execution results where the Studio RPC returns them, both final decisions and the challenged evidence disposition. It reads existing state without issuing transactions. Use the demo buttons to inspect each claim in the public dashboard. To reproduce signing, import the deployed instance through the Studio link, use built-in accounts to register a new policy and open a claim, then copy each transaction hash into the dashboard tracker. The deployment/schema checks and transaction execution ran on StudioNet. The standalone GenVM linter was unavailable from the package index in this environment.
