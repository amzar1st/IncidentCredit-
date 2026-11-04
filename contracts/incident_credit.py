# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
import hashlib
import json
import re
import time

from genlayer import TreeMap, gl, u256

HOUR = 3600
MAX_WINDOW = 7 * 86400
TOKEN = r"[a-z0-9][a-z0-9-]{0,47}"
REPOSITORY = r"[A-Za-z0-9_-]{1,39}/[A-Za-z0-9_.-]{1,100}"
DIGEST = r"[0-9a-f]{64}"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def canonical(record):
    return json.dumps(record, sort_keys=True, separators=(",", ":"))


def digest(data):
    return hashlib.sha256(data).hexdigest()


def validate_reference(repo, revision, sha):
    require(re.fullmatch(r"[0-9a-f]{40}", revision) is not None, "Use a full lowercase commit SHA")
    require(re.fullmatch(DIGEST, sha) is not None, "Use a lowercase SHA-256 digest")
    return {"url": f"https://raw.githubusercontent.com/{repo}/{revision}/incident.json", "sha256": sha}


def evaluate(source, claim, policy):
    record = {"url": source["url"], "expected_sha256": source["sha256"]}
    try:
        response = gl.nondet.web.get(source["url"])
    except Exception:
        return {**record, "status": "UNAVAILABLE"}
    if response.status_code != 200:
        return {**record, "status": "UNAVAILABLE"}
    if not 0 < len(response.body) <= 16384:
        return {**record, "status": "INVALID_SIZE"}
    observed = digest(response.body)
    record["observed_sha256"] = observed
    if observed != source["sha256"]:
        return {**record, "status": "HASH_MISMATCH"}
    try:
        payload = json.loads(response.body.decode("utf-8"))
        if type(payload) is not dict or payload.get("schema") != "incidentcredit/1":
            raise ValueError()
        if payload.get("incident") != claim["incident"] or payload.get("service") != policy["service"]:
            return {**record, "status": "OUT_OF_SCOPE"}
        regions = payload.get("regions")
        if type(regions) is not dict or len(regions) > 32:
            raise ValueError()
        if claim["region"] not in regions:
            return {**record, "status": "OUT_OF_SCOPE"}
        finding = regions[claim["region"]]
        if type(finding) is not dict:
            raise ValueError()
        kind = finding.get("status")
        if kind == "UNAFFECTED":
            return {**record, "status": "VALID", "finding": [kind, 0, 0]}
        if kind not in ("OUTAGE", "SCHEDULED_MAINTENANCE"):
            raise ValueError()
        start, end = finding.get("start"), finding.get("end")
        if type(start) is not int or type(end) is not int or not 0 < start < end <= claim["opened"]:
            raise ValueError()
        if end - start > MAX_WINDOW:
            raise ValueError()
        return {**record, "status": "VALID", "finding": [kind, start, end]}
    except (ValueError, RecursionError):
        return {**record, "status": "INVALID_SCHEMA"}


def decide(evidence, claim, policy):
    findings = [item["finding"] for item in evidence if item["status"] == "VALID"]
    outcome, reason, seconds, credit = "INCONCLUSIVE", "NO_VALID_EVIDENCE", 0, 0
    if findings:
        if any(item != findings[0] for item in findings):
            reason = "CONFLICTING_REPORTS"
        else:
            kind, start, end = findings[0]
            seconds = max(0, min(claim["end"], end) - max(claim["start"], start))
            if kind == "UNAFFECTED":
                outcome, reason = "DENIED", "REGION_UNAFFECTED"
            elif kind == "SCHEDULED_MAINTENANCE" and policy["exclude_maintenance"]:
                outcome, reason = "DENIED", "SCHEDULED_MAINTENANCE"
            elif seconds < policy["minimum_seconds"]:
                outcome, reason = "DENIED", "BELOW_MINIMUM"
            else:
                credit = min(policy["cap_minor"], seconds * policy["hourly_minor"] // HOUR)
                outcome, reason = "QUALIFIED", "COVERED_OUTAGE"
    return {"outcome": outcome, "reason": reason, "seconds": seconds, "credit_minor": credit, "evidence": evidence}


class IncidentCredit(gl.Contract):
    policies: TreeMap[str, str]
    claims: TreeMap[str, str]

    def __init__(self):
        pass

    @gl.public.view
    def version(self) -> str:
        return "incidentcredit/1"

    @gl.public.view
    def get_policy(self, policy_id: str) -> str:
        require(policy_id in self.policies, "Policy not found")
        return self.policies[policy_id]

    @gl.public.view
    def get_claim(self, claim_id: str) -> str:
        require(claim_id in self.claims, "Claim not found")
        return self.claims[claim_id]

    @gl.public.write
    def register_policy(self, customer: str, service: str, regions: str,
                        report_repo: str, review_repo: str, currency: str,
                        minimum_seconds: u256, hourly_minor: u256, cap_minor: u256,
                        exclude_maintenance: bool, challenge_seconds: u256) -> None:
        provider = str(gl.message.sender_address).lower()
        require(re.fullmatch(r"0x[0-9a-fA-F]{40}", customer) is not None, "Invalid customer address")
        customer = customer.lower()
        require(provider != customer, "Provider and customer must differ")
        require(re.fullmatch(TOKEN, service) is not None, "Invalid service")
        region_list = regions.split(",")
        require(1 <= len(region_list) <= 8 and len(set(region_list)) == len(region_list)
                and all(re.fullmatch(TOKEN, item) for item in region_list), "Invalid region list")
        require(all(re.fullmatch(REPOSITORY, repo) and ".." not in repo
                    for repo in (report_repo, review_repo)), "Invalid evidence repository")
        require(report_repo.split("/")[0].lower() != review_repo.split("/")[0].lower(),
                "Use separate publisher accounts")
        require(re.fullmatch(r"[A-Z]{3}", currency) is not None, "Use a three-letter currency")
        require(1 <= minimum_seconds <= MAX_WINDOW, "Invalid minimum duration")
        require(1 <= hourly_minor <= 10**9 and 1 <= cap_minor <= 10**9, "Invalid rate or cap")
        require(60 <= challenge_seconds <= 7 * 86400, "Challenge period must be 60–604800 seconds")
        data = {"provider": provider, "customer": customer,
                "service": service, "regions": sorted(region_list), "report_repo": report_repo,
                "review_repo": review_repo, "currency": currency, "minimum_seconds": int(minimum_seconds),
                "hourly_minor": int(hourly_minor), "cap_minor": int(cap_minor),
                "exclude_maintenance": exclude_maintenance, "challenge_seconds": int(challenge_seconds)}
        key = digest(canonical(data).encode())
        require(key not in self.policies, "Policy already registered")
        self.policies[key] = canonical(data)
        print("Policy ID:", key)

    @gl.public.write
    def open_claim(self, policy_id: str, incident: str, region: str, start: u256, end: u256,
                   revision: str, sha256: str) -> None:
        policy = json.loads(self.get_policy(policy_id))
        require(str(gl.message.sender_address).lower() == policy["customer"], "Customer only")
        require(re.fullmatch(TOKEN, incident) is not None and region in policy["regions"], "Invalid scope")
        now = int(time.time())
        require(0 < start < end <= now and end - start <= MAX_WINDOW, "Invalid claim window")
        key = digest(canonical([policy_id, incident, region]).encode())
        require(key not in self.claims, "Claim already exists")
        source = validate_reference(policy["report_repo"], revision, sha256)
        self.claims[key] = canonical({
            "policy_id": policy_id, "incident": incident, "region": region, "start": int(start),
            "end": int(end), "opened": now, "status": "OPEN", "sources": [source], "reviews": [],
            "deadline": now + 86400,
        })
        print("Claim ID:", key)

    @gl.public.write
    def review(self, claim_id: str) -> None:
        claim = json.loads(self.get_claim(claim_id))
        policy = json.loads(self.get_policy(claim["policy_id"]))
        now = int(time.time())
        require(claim["status"] in ("OPEN", "CHALLENGED") and now < claim["deadline"], "Review closed")

        def inspect():
            evidence = [evaluate(source, claim, policy) for source in claim["sources"]]
            return canonical(decide(evidence, claim, policy))

        result = json.loads(gl.eq_principle.strict_eq(inspect))
        result["decision_sha256"] = digest(canonical([claim_id, len(claim["reviews"]), result]).encode())
        claim["reviews"].append(result)
        claim["status"] = "REVIEWED" if len(claim["reviews"]) == 1 else "READY"
        claim["deadline"] = now + policy["challenge_seconds"] if claim["status"] == "REVIEWED" else now
        self.claims[claim_id] = canonical(claim)

    @gl.public.write
    def challenge(self, claim_id: str, revision: str, sha256: str) -> None:
        claim = json.loads(self.get_claim(claim_id))
        policy = json.loads(self.get_policy(claim["policy_id"]))
        now = int(time.time())
        require(claim["status"] == "REVIEWED" and now < claim["deadline"], "Challenge closed")
        sender = str(gl.message.sender_address).lower()
        require(sender in (policy["customer"], policy["provider"]), "Party only")
        claim["sources"].append(validate_reference(policy["review_repo"], revision, sha256))
        claim["challenger"] = sender
        claim["status"] = "CHALLENGED"
        claim["deadline"] = now + 86400
        self.claims[claim_id] = canonical(claim)

    @gl.public.write
    def finalize(self, claim_id: str) -> None:
        claim = json.loads(self.get_claim(claim_id))
        require(claim["status"] != "FINALIZED" and int(time.time()) >= claim["deadline"], "Finalization unavailable")
        if claim["status"] in ("OPEN", "CHALLENGED"):
            result = {"outcome": "INCONCLUSIVE", "reason": "REVIEW_TIMEOUT", "seconds": 0,
                      "credit_minor": 0, "evidence": []}
            result["decision_sha256"] = digest(canonical([claim_id, len(claim["reviews"]), result]).encode())
            claim["reviews"].append(result)
        claim["status"] = "FINALIZED"
        self.claims[claim_id] = canonical(claim)
