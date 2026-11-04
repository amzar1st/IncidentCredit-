# IncidentCredit

IncidentCredit evaluates regional service-outage claims against an immutable SLA. GenLayer validators retrieve public, commit-pinned incident reports independently, verify SHA-256 digests, and reach exact agreement on the normalized evidence findings and calculated credit. The browser dashboard reads finalized chain state and tracks real transaction receipts. Writes are signed inside GenLayer Studio with its built-in account.

## Review the project

- [Public dashboard](https://incidentcredit.tinymule33.chatgpt.site)
- [StudioNet contract](https://explorer-studio.genlayer.com/address/0x6Ea406Bd157Fe1931A28117Db69A4F508Ff53E44)
- [Live verification](docs/LIVE_VERIFICATION.md)
- [Contract and evidence model](docs/PROTOCOL.md)

## Local checks

Use Node 22 and Python 3.12 or compatible versions.

```sh
npm ci
npm test
npm run build
npm run dev
```

The unit suite uses a small GenVM shim for state-machine and adversarial evidence checks. The StudioNet receipts independently exercise the actual GenVM and consensus behavior. The dashboard defaults to the public deployment on chain 61999.
