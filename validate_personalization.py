#!/usr/bin/env python3
"""
Validate that Contentful nt_experience / nt_audience entries
are correctly synced with the Ninetailed Experience API.

Reads configuration straight from the ContentfulDemoOptimized/.env file.
Uses the CMA token for deep inspection (webhooks, environments, aliases).
"""

import sys
import json
import uuid
import requests
from datetime import datetime, timezone
from pathlib import Path
from tabulate import tabulate
from tqdm import tqdm

# ──────────────────────────────────────────────────────────────
# 1.  Load .env
# ──────────────────────────────────────────────────────────────
ENV_PATH = Path(__file__).parent / "ContentfulDemoOptimized" / ".env"


def load_env(path: Path) -> dict[str, str]:
    env = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            key, _, value = line.partition("=")
            env[key.strip()] = value.strip()
    return env


env = load_env(ENV_PATH)

CONTENTFUL_SPACE_ID = env["CONTENTFUL_SPACE_ID"]
CONTENTFUL_ACCESS_TOKEN = env["CONTENTFUL_ACCESS_TOKEN"]
CONTENTFUL_MANAGEMENT_ACCESS_TOKEN = env.get("CONTENTFUL_MANAGEMENT_ACCESS_TOKEN", "")
CONTENTFUL_ENVIRONMENT = env["CONTENTFUL_ENVIRONMENT"]
OPTIMIZATION_CLIENT_ID = env["OPTIMIZATION_CLIENT_ID"]
OPTIMIZATION_ENVIRONMENT = env["OPTIMIZATION_ENVIRONMENT"]

has_cma = bool(CONTENTFUL_MANAGEMENT_ACCESS_TOKEN)

print("=" * 72)
print("  Personalization Validation")
print("=" * 72)
print()
print(f"  .env loaded from: {ENV_PATH}")
print(f"  Contentful space:       {CONTENTFUL_SPACE_ID}")
print(f"  Contentful environment: {CONTENTFUL_ENVIRONMENT}")
print(f"  Contentful CDN token:   {CONTENTFUL_ACCESS_TOKEN[:8]}…")
if has_cma:
    print(f"  Contentful CMA token:   {CONTENTFUL_MANAGEMENT_ACCESS_TOKEN[:12]}…")
else:
    print(f"  Contentful CMA token:   (not set — webhook/env checks will be limited)")
print(f"  Optimization client:    {OPTIMIZATION_CLIENT_ID}")
print(f"  Optimization env:       {OPTIMIZATION_ENVIRONMENT}")
print()

# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────
CMA_BASE = f"https://api.contentful.com/spaces/{CONTENTFUL_SPACE_ID}"
CMA_HEADERS = {"Authorization": f"Bearer {CONTENTFUL_MANAGEMENT_ACCESS_TOKEN}"}

CDN_BASE = (
    f"https://cdn.contentful.com/spaces/{CONTENTFUL_SPACE_ID}"
    f"/environments/{CONTENTFUL_ENVIRONMENT}"
)
CDN_HEADERS = {"Authorization": f"Bearer {CONTENTFUL_ACCESS_TOKEN}"}


def cma_get(path: str, params: dict | None = None) -> requests.Response:
    return requests.get(f"{CMA_BASE}{path}", headers=CMA_HEADERS, params=params or {})


def cdn_get(path: str, params: dict | None = None) -> requests.Response:
    return requests.get(f"{CDN_BASE}{path}", headers=CDN_HEADERS, params=params or {})


# ──────────────────────────────────────────────────────────────
# 2.  Environments & aliases  (CMA)
# ──────────────────────────────────────────────────────────────
print("─" * 72)
print("  Step 1: Checking environments & aliases")
print("─" * 72)

env_list: list[dict] = []
alias_map: dict[str, str] = {}  # alias_id -> target_env_id
resolved_env: str | None = None

if has_cma:
    r = cma_get("/environments", {"limit": 25})
    if r.status_code == 200:
        env_list = r.json().get("items", [])
        env_rows = []
        for e in env_list:
            eid = e["sys"]["id"]
            status = e["sys"].get("status", {}).get("sys", {}).get("id", "?")
            aliases = e.get("sys", {}).get("aliases", [])
            alias_ids = [a["sys"]["id"] for a in aliases] if aliases else []
            for aid in alias_ids:
                alias_map[aid] = eid
            env_rows.append([eid, status, ", ".join(alias_ids) or "—"])

        print(f"\n  Found {len(env_list)} environments:\n")
        print(tabulate(env_rows, headers=["Environment", "Status", "Aliases"],
                        tablefmt="simple_outline"))

        # Resolve the configured environment
        if CONTENTFUL_ENVIRONMENT in alias_map:
            resolved_env = alias_map[CONTENTFUL_ENVIRONMENT]
            print(f"\n  '{CONTENTFUL_ENVIRONMENT}' is an alias → "
                  f"resolves to environment '{resolved_env}'")
        else:
            actual_ids = {e["sys"]["id"] for e in env_list}
            if CONTENTFUL_ENVIRONMENT in actual_ids:
                resolved_env = CONTENTFUL_ENVIRONMENT
                print(f"\n  '{CONTENTFUL_ENVIRONMENT}' is a real environment (not an alias)")
            else:
                print(f"\n  ⚠  '{CONTENTFUL_ENVIRONMENT}' not found as environment or alias!")
    else:
        print(f"\n  [WARN] CMA environments call returned {r.status_code}: {r.text[:200]}")
else:
    print("\n  (skipped — no CMA token)")

# ──────────────────────────────────────────────────────────────
# 3.  Fetch Contentful entries  (CDN)
# ──────────────────────────────────────────────────────────────
print()
print("─" * 72)
print("  Step 2: Fetching Contentful entries (CDN)")
print("─" * 72)


def fetch_cdn_entries(content_type: str) -> list[dict]:
    entries: list[dict] = []
    skip = 0
    limit = 100
    while True:
        resp = cdn_get("/entries", {"content_type": content_type,
                                     "skip": skip, "limit": limit})
        if resp.status_code != 200:
            print(f"  [ERROR] CDN returned {resp.status_code} for {content_type}")
            print(f"          {resp.text[:300]}")
            return entries
        data = resp.json()
        entries.extend(data.get("items", []))
        if skip + limit >= data.get("total", 0):
            break
        skip += limit
    return entries


content_types_to_fetch = ["nt_experience", "nt_audience"]
cf_entries: dict[str, list[dict]] = {}

for ct in tqdm(content_types_to_fetch, desc="  CDN content types"):
    cf_entries[ct] = fetch_cdn_entries(ct)

cf_experiences = cf_entries["nt_experience"]
cf_audiences = cf_entries["nt_audience"]

print(f"\n  Found {len(cf_experiences)} nt_experience entries")
print(f"  Found {len(cf_audiences)} nt_audience entries")

# Build lookup maps
cf_exp_map: dict[str, dict] = {}
for e in cf_experiences:
    fields = e.get("fields", {})
    exp_id = fields.get("nt_experience_id", "")
    cf_exp_map[exp_id] = {
        "sys_id": e["sys"]["id"],
        "nt_experience_id": exp_id,
        "name": fields.get("nt_name", ""),
        "config": fields.get("nt_config", {}),
    }

cf_aud_map: dict[str, dict] = {}
for a in cf_audiences:
    fields = a.get("fields", {})
    aud_id = fields.get("nt_audience_id", "")
    cf_aud_map[aud_id] = {
        "sys_id": a["sys"]["id"],
        "nt_audience_id": aud_id,
        "name": fields.get("nt_name", ""),
    }

# ──────────────────────────────────────────────────────────────
# 3b.  Cross-check with CMA entries (if CDN env ≠ CMA resolved)
# ──────────────────────────────────────────────────────────────
if has_cma and resolved_env:
    # Also fetch via CMA to see if the Management API returns the same set
    def fetch_cma_entries(content_type: str, env_id: str) -> list[dict]:
        entries: list[dict] = []
        skip = 0
        limit = 100
        while True:
            r = cma_get(f"/environments/{env_id}/entries",
                        {"content_type": content_type, "skip": skip, "limit": limit})
            if r.status_code != 200:
                print(f"  [WARN] CMA returned {r.status_code} for {content_type} "
                      f"in env '{env_id}'")
                return entries
            data = r.json()
            entries.extend(data.get("items", []))
            if skip + limit >= data.get("total", 0):
                break
            skip += limit
        return entries

    # Check if the alias resolution gives more entries
    target_env = resolved_env
    if CONTENTFUL_ENVIRONMENT in alias_map:
        # Also try the alias name directly via CMA (it resolves internally)
        target_env = CONTENTFUL_ENVIRONMENT

    cma_exps = fetch_cma_entries("nt_experience", target_env)
    cma_auds = fetch_cma_entries("nt_audience", target_env)

    cdn_exp_ids = {e["sys"]["id"] for e in cf_experiences}
    cma_exp_ids = {e["sys"]["id"] for e in cma_exps}
    cdn_aud_ids = {a["sys"]["id"] for a in cf_audiences}
    cma_aud_ids = {a["sys"]["id"] for a in cma_auds}

    if cdn_exp_ids != cma_exp_ids or cdn_aud_ids != cma_aud_ids:
        print(f"\n  ⚠  CDN vs CMA entry mismatch for env '{target_env}'!")
        print(f"     CDN experiences: {len(cdn_exp_ids)}, CMA: {len(cma_exp_ids)}")
        print(f"     CDN audiences:   {len(cdn_aud_ids)}, CMA: {len(cma_aud_ids)}")
        only_cma_exp = cma_exp_ids - cdn_exp_ids
        only_cdn_exp = cdn_exp_ids - cma_exp_ids
        if only_cma_exp:
            print(f"     CMA-only experiences: {only_cma_exp}")
        if only_cdn_exp:
            print(f"     CDN-only experiences: {only_cdn_exp}")
    else:
        print(f"\n  CDN and CMA return identical entry sets for '{target_env}' ✓")

# ──────────────────────────────────────────────────────────────
# 4.  Call Ninetailed Experience API
# ──────────────────────────────────────────────────────────────
print()
print("─" * 72)
print("  Step 3: Calling Ninetailed Experience API")
print("─" * 72)


def call_ninetailed(nt_env: str) -> tuple[int, dict]:
    url = (
        f"https://experience.ninetailed.co/v2/organizations"
        f"/{OPTIMIZATION_CLIENT_ID}/environments/{nt_env}/profiles"
    )
    msg_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    payload = {
        "events": [{
            "type": "screen", "channel": "mobile", "name": "Home",
            "properties": {"name": "Home"}, "messageId": msg_id,
            "timestamp": now, "originalTimestamp": now, "sentAt": now,
            "context": {
                "app": {"name": "ContentfulDemo", "version": "1.0.0"},
                "campaign": {}, "gdpr": {"isConsentGiven": True},
                "library": {"name": "validation-script", "version": "1.0.0"},
                "locale": "en-US", "screen": {"name": "Home"},
            },
        }],
        "options": {"features": ["ip-enrichment", "location"]},
    }
    r = requests.post(url, headers={"Content-Type": "text/plain"},
                       data=json.dumps(payload))
    try:
        return r.status_code, r.json()
    except Exception:
        return r.status_code, {}


FALLBACK_ENVS = ["main", "master", "production"]
nt_env_used = OPTIMIZATION_ENVIRONMENT
status, nt_json = call_ninetailed(OPTIMIZATION_ENVIRONMENT)

if status == 404:
    print(f"  [WARN] Ninetailed returned 404 for environment "
          f"'{OPTIMIZATION_ENVIRONMENT}'")
    tried = [OPTIMIZATION_ENVIRONMENT]
    for alt in FALLBACK_ENVS:
        if alt in tried:
            continue
        tried.append(alt)
        print(f"         Trying '{alt}'…", end=" ")
        status, nt_json = call_ninetailed(alt)
        if status == 200:
            print("OK!")
            nt_env_used = alt
            print(f"\n  ⚠  OPTIMIZATION_ENVIRONMENT mismatch!")
            print(f"     .env has '{OPTIMIZATION_ENVIRONMENT}' but "
                  f"Ninetailed only responds to '{alt}'.")
            print(f"     → Update OPTIMIZATION_ENVIRONMENT={alt} in .env")
            break
        else:
            print(f"{status}")

if status != 200:
    print(f"\n  [ERROR] Ninetailed returned {status} for all environments tried")
    print(f"          {json.dumps(nt_json)[:500]}")
    sys.exit(1)

nt_data = nt_json.get("data", {})
nt_experiences = nt_data.get("experiences", [])
nt_audiences = set(nt_data.get("profile", {}).get("audiences", []))
nt_profile = nt_data.get("profile", {})

print(f"\n  Ninetailed returned {len(nt_experiences)} experiences "
      f"and {len(nt_audiences)} audiences")
print(f"  Profile ID: {nt_profile.get('id', 'N/A')[:16]}…")

loc = nt_profile.get("location", {})
if loc:
    print(f"  Location:   {loc.get('city')}, {loc.get('countryCode')}")

session = nt_profile.get("session", {})
print(f"  Session:    count={session.get('count')}, "
      f"returning={session.get('isReturningVisitor')}")

# ──────────────────────────────────────────────────────────────
# 5.  Cross-reference Experiences
# ──────────────────────────────────────────────────────────────
print()
print("─" * 72)
print("  Step 4: Cross-referencing experiences")
print("─" * 72)

nt_exp_ids = {e["experienceId"] for e in nt_experiences}

exp_rows = []
for exp in nt_experiences:
    eid = exp["experienceId"]
    vi = exp.get("variantIndex", "?")
    variants = exp.get("variants", {})
    sticky = exp.get("sticky", False)
    cf = cf_exp_map.get(eid)
    st = "MATCH" if cf else "NO MATCH"
    name = cf["name"] if cf else "—"
    exp_rows.append([eid[:24], vi, len(variants), sticky, st, name])

print("\n  Ninetailed experiences → Contentful:\n")
print(tabulate(exp_rows,
               headers=["Experience ID", "Var Idx", "#Vars", "Sticky",
                         "Status", "CF Name"],
               tablefmt="simple_outline"))

missing_exp_rows = []
for exp_id, cf in cf_exp_map.items():
    if exp_id not in nt_exp_ids:
        missing_exp_rows.append([
            cf["sys_id"][:24], exp_id[:24], cf["name"], "MISSING",
        ])

if missing_exp_rows:
    print(f"\n  Contentful experiences NOT in Ninetailed ({len(missing_exp_rows)}):\n")
    print(tabulate(missing_exp_rows,
                   headers=["sys.id", "nt_experience_id", "Name", "Status"],
                   tablefmt="simple_outline"))

# ──────────────────────────────────────────────────────────────
# 6.  Cross-reference Audiences
# ──────────────────────────────────────────────────────────────
print()
print("─" * 72)
print("  Step 5: Cross-referencing audiences")
print("─" * 72)

aud_rows = []
for aud_id in sorted(nt_audiences):
    cf = cf_aud_map.get(aud_id)
    st = "MATCH" if cf else "NO MATCH"
    name = cf["name"] if cf else "—"
    aud_rows.append([aud_id[:24], st, name])

print("\n  Ninetailed audiences → Contentful:\n")
print(tabulate(aud_rows,
               headers=["Audience ID", "Status", "CF Name"],
               tablefmt="simple_outline"))

missing_aud_rows = []
for aud_id, cf in cf_aud_map.items():
    if aud_id not in nt_audiences:
        missing_aud_rows.append([
            cf["sys_id"][:24], aud_id[:24], cf["name"], "MISSING",
        ])

if missing_aud_rows:
    print(f"\n  Contentful audiences NOT in Ninetailed ({len(missing_aud_rows)}):\n")
    print(tabulate(missing_aud_rows,
                   headers=["sys.id", "nt_audience_id", "Name", "Status"],
                   tablefmt="simple_outline"))

# ──────────────────────────────────────────────────────────────
# 7.  Variant-level validation (matched experiences)
# ──────────────────────────────────────────────────────────────
print()
print("─" * 72)
print("  Step 6: Variant-level validation (matched experiences)")
print("─" * 72)

for exp in nt_experiences:
    eid = exp["experienceId"]
    cf = cf_exp_map.get(eid)
    if not cf:
        continue

    nt_variants = exp.get("variants", {})
    cf_components = cf.get("config", {}).get("components", [])

    cf_variant_map: dict[str, str] = {}
    for comp in cf_components:
        if comp.get("type") == "EntryReplacement":
            bid = comp.get("baseline", {}).get("id", "")
            vlist = comp.get("variants", [])
            if isinstance(vlist, list):
                for v in vlist:
                    vid = v.get("id", "")
                    if bid and vid:
                        cf_variant_map[bid] = vid
            elif isinstance(vlist, dict):
                vid = vlist.get("id", "")
                if bid and vid:
                    cf_variant_map[bid] = vid

    print(f"\n  Experience: {cf['name']} ({eid[:20]}…)")

    if not cf_variant_map and not nt_variants:
        print("    (inline variables only — no entry replacements)")
        continue

    var_rows = []
    for baseline, variant in nt_variants.items():
        cf_expected = cf_variant_map.get(baseline)
        if cf_expected == variant:
            st = "MATCH"
        elif cf_expected is None:
            st = "BASELINE NOT IN CF"
        else:
            st = f"MISMATCH (CF expects {cf_expected[:16]}…)"
        var_rows.append([baseline[:22], variant[:22], st])

    for baseline, variant in cf_variant_map.items():
        if baseline not in nt_variants:
            var_rows.append([baseline[:22], variant[:22], "MISSING from NT"])

    print(tabulate(var_rows,
                   headers=["Baseline ID", "Variant ID", "Status"],
                   tablefmt="simple_outline"))

# ──────────────────────────────────────────────────────────────
# 8.  Webhooks & App Events  (CMA)
# ──────────────────────────────────────────────────────────────
print()
print("─" * 72)
print("  Step 7: Webhooks & App Events")
print("─" * 72)

webhooks: list[dict] = []

if has_cma:
    r = cma_get("/webhook_definitions")
    if r.status_code == 200:
        webhooks = r.json().get("items", [])
        print(f"\n  Traditional webhooks: {len(webhooks)}")
        if webhooks:
            wh_rows = []
            for w in webhooks:
                wh_rows.append([
                    w.get("name", "?")[:30],
                    w.get("url", "?")[:55],
                    w.get("active", "?"),
                    len(w.get("topics", [])),
                ])
            print(tabulate(wh_rows,
                           headers=["Name", "URL", "Active", "#Topics"],
                           tablefmt="simple_outline"))

    print()
    print("  NOTE: Contentful Personalization (Ninetailed) uses the App Framework's")
    print("  'App Events' system (appEvent.handler), NOT traditional webhook definitions.")
    print("  Zero traditional webhooks is normal for this integration.")
    print("  The app receives publish/unpublish events via App Events automatically")
    print("  when the Contentful Personalization app is installed and configured.")
else:
    print("\n  (skipped — no CMA token)")

# ──────────────────────────────────────────────────────────────
# 8b. Cross-environment comparison  (CMA)
# ──────────────────────────────────────────────────────────────
print()
print("─" * 72)
print("  Step 7b: Cross-environment comparison")
print("─" * 72)

# The Ninetailed Experience API is bound to a specific environment (nt_env_used).
# If that differs from CONTENTFUL_ENVIRONMENT, check if the NT env has entries
# whose nt_experience_ids match the stale Ninetailed IDs.
nt_env_exp_map: dict[str, dict] = {}
nt_env_aud_map: dict[str, dict] = {}

if has_cma and nt_env_used != CONTENTFUL_ENVIRONMENT:
    print(f"\n  App reads CDN env '{CONTENTFUL_ENVIRONMENT}', "
          f"but Ninetailed uses env '{nt_env_used}'.")
    print(f"  Fetching nt_experience & nt_audience from '{nt_env_used}' via CMA…")

    def fetch_cma_ct(content_type: str, env_id: str) -> list[dict]:
        entries_out: list[dict] = []
        skip = 0
        while True:
            r = cma_get(f"/environments/{env_id}/entries",
                        {"content_type": content_type, "skip": skip, "limit": 100})
            if r.status_code != 200:
                print(f"  [WARN] CMA returned {r.status_code} for {content_type} "
                      f"in '{env_id}'")
                return entries_out
            data = r.json()
            entries_out.extend(data.get("items", []))
            if skip + 100 >= data.get("total", 0):
                break
            skip += 100
        return entries_out

    nt_env_exps = fetch_cma_ct("nt_experience", nt_env_used)
    nt_env_auds = fetch_cma_ct("nt_audience", nt_env_used)

    for e in nt_env_exps:
        f = e.get("fields", {})
        eid = f.get("nt_experience_id", {}).get("en-US", "")
        name = f.get("nt_name", {}).get("en-US", "")
        nt_env_exp_map[eid] = {"sys_id": e["sys"]["id"], "name": name}
    for a in nt_env_auds:
        f = a.get("fields", {})
        aid = f.get("nt_audience_id", {}).get("en-US", "")
        name = f.get("nt_name", {}).get("en-US", "")
        nt_env_aud_map[aid] = {"sys_id": a["sys"]["id"], "name": name}

    print(f"\n  '{nt_env_used}' has {len(nt_env_exp_map)} experiences, "
          f"{len(nt_env_aud_map)} audiences")

    # Now cross-reference Ninetailed API IDs against the NT environment
    nt_env_exp_match = nt_exp_ids & set(nt_env_exp_map.keys())
    nt_env_aud_match = nt_audiences & set(nt_env_aud_map.keys())

    print(f"  NT API experience IDs matching '{nt_env_used}': "
          f"{len(nt_env_exp_match)}/{len(nt_exp_ids)}")
    print(f"  NT API audience IDs matching '{nt_env_used}':   "
          f"{len(nt_env_aud_match)}/{len(nt_audiences)}")

    if nt_env_exp_match or nt_env_aud_match:
        # Show which ones match
        if nt_env_exp_match:
            rows = []
            for eid in sorted(nt_env_exp_match):
                name = nt_env_exp_map[eid]["name"]
                rows.append([eid[:24], name, f"in '{nt_env_used}'"])
            print(f"\n  Experiences matching '{nt_env_used}':\n")
            print(tabulate(rows,
                           headers=["Experience ID", "Name", "Source"],
                           tablefmt="simple_outline"))

        if nt_env_aud_match:
            rows = []
            for aid in sorted(nt_env_aud_match):
                name = nt_env_aud_map[aid]["name"]
                rows.append([aid[:24], name, f"in '{nt_env_used}'"])
            print(f"\n  Audiences matching '{nt_env_used}':\n")
            print(tabulate(rows,
                           headers=["Audience ID", "Name", "Source"],
                           tablefmt="simple_outline"))

    # Also check: do the CDN env entries exist in the NT env?
    cdn_in_nt = set(cf_exp_map.keys()) & set(nt_env_exp_map.keys())
    cdn_only = set(cf_exp_map.keys()) - set(nt_env_exp_map.keys())
    nt_only = set(nt_env_exp_map.keys()) - set(cf_exp_map.keys())

    print(f"\n  Experience ID overlap between environments:")
    print(f"    Both '{CONTENTFUL_ENVIRONMENT}' and '{nt_env_used}': {len(cdn_in_nt)}")
    print(f"    Only in '{CONTENTFUL_ENVIRONMENT}': {len(cdn_only)}")
    print(f"    Only in '{nt_env_used}': {len(nt_only)}")

    if cdn_only:
        rows = []
        for eid in sorted(cdn_only):
            rows.append([eid[:24], cf_exp_map[eid]["name"],
                         CONTENTFUL_ENVIRONMENT])
        print(f"\n  Experiences ONLY in '{CONTENTFUL_ENVIRONMENT}' "
              f"(not in '{nt_env_used}'):\n")
        print(tabulate(rows,
                       headers=["nt_experience_id", "Name", "Environment"],
                       tablefmt="simple_outline"))

    if nt_only:
        rows = []
        for eid in sorted(nt_only):
            rows.append([eid[:24], nt_env_exp_map[eid]["name"],
                         nt_env_used])
        print(f"\n  Experiences ONLY in '{nt_env_used}' "
              f"(not in '{CONTENTFUL_ENVIRONMENT}'):\n")
        print(tabulate(rows,
                       headers=["nt_experience_id", "Name", "Environment"],
                       tablefmt="simple_outline"))

elif nt_env_used == CONTENTFUL_ENVIRONMENT:
    print(f"\n  CDN and Ninetailed both use '{nt_env_used}' — no cross-env check needed.")
else:
    print("\n  (skipped — no CMA token for cross-env check)")

# ──────────────────────────────────────────────────────────────
# 9.  Environment alias consistency check  (CMA)
# ──────────────────────────────────────────────────────────────
print()
print("─" * 72)
print("  Step 8: Environment consistency")
print("─" * 72)

issues: list[str] = []

# Check if Ninetailed env matches a real Contentful env or alias
if env_list:
    all_env_ids = {e["sys"]["id"] for e in env_list}
    all_alias_ids = set(alias_map.keys())
    all_known = all_env_ids | all_alias_ids

    if nt_env_used not in all_known:
        issues.append(
            f"Ninetailed env '{nt_env_used}' is not a known "
            f"Contentful environment or alias.\n"
            f"     Known envs: {sorted(all_env_ids)}\n"
            f"     Known aliases: {sorted(all_alias_ids)}"
        )

    if CONTENTFUL_ENVIRONMENT not in all_known:
        issues.append(
            f"CONTENTFUL_ENVIRONMENT='{CONTENTFUL_ENVIRONMENT}' is not a known "
            f"environment or alias."
        )

    # Check that CDN and NT env resolve to the same actual env
    cf_resolved = alias_map.get(CONTENTFUL_ENVIRONMENT, CONTENTFUL_ENVIRONMENT)
    nt_resolved = alias_map.get(nt_env_used, nt_env_used)
    if cf_resolved != nt_resolved:
        issues.append(
            f"CDN env '{CONTENTFUL_ENVIRONMENT}' resolves to '{cf_resolved}' "
            f"but Ninetailed env '{nt_env_used}' resolves to '{nt_resolved}'.\n"
            f"     These point to DIFFERENT environments!"
        )
    else:
        print(f"\n  CDN env '{CONTENTFUL_ENVIRONMENT}' and Ninetailed env "
              f"'{nt_env_used}' both resolve to '{cf_resolved}' ✓")

if OPTIMIZATION_ENVIRONMENT != nt_env_used:
    issues.append(
        f"OPTIMIZATION_ENVIRONMENT='{OPTIMIZATION_ENVIRONMENT}' in .env "
        f"but Ninetailed actually uses '{nt_env_used}'."
    )

if issues:
    for i, issue in enumerate(issues, 1):
        print(f"\n  ⚠  Issue {i}: {issue}")
elif not env_list:
    print("\n  (environment checks skipped — no CMA token or no envs found)")
else:
    print()

# ──────────────────────────────────────────────────────────────
# 10.  Summary
# ──────────────────────────────────────────────────────────────
print()
print("=" * 72)
print("  SUMMARY")
print("=" * 72)

total_exp_match = len(nt_exp_ids & set(cf_exp_map.keys()))
total_aud_match = len(nt_audiences & set(cf_aud_map.keys()))

print(f"""
  Contentful:
    Space:        {CONTENTFUL_SPACE_ID}
    Environment:  {CONTENTFUL_ENVIRONMENT}{f" → {resolved_env}" if resolved_env and resolved_env != CONTENTFUL_ENVIRONMENT else ""}
    Experiences:  {len(cf_exp_map)} entries
    Audiences:    {len(cf_aud_map)} entries

  Ninetailed:
    Client ID:    {OPTIMIZATION_CLIENT_ID}
    Environment:  {nt_env_used}{" (fallback)" if nt_env_used != OPTIMIZATION_ENVIRONMENT else ""}
    Experiences:  {len(nt_experiences)} returned
    Audiences:    {len(nt_audiences)} returned

  Sync:
    Experiences:  {total_exp_match}/{len(nt_exp_ids)} NT IDs match Contentful
                  {len(cf_exp_map) - total_exp_match}/{len(cf_exp_map)} CF entries missing from Ninetailed
                  {len(nt_exp_ids) - total_exp_match}/{len(nt_exp_ids)} NT IDs are stale (no CF entry)

    Audiences:    {total_aud_match}/{len(nt_audiences)} NT IDs match Contentful
                  {len(cf_aud_map) - total_aud_match}/{len(cf_aud_map)} CF entries missing from Ninetailed
                  {len(nt_audiences) - total_aud_match}/{len(nt_audiences)} NT IDs are stale (no CF entry)

    Webhooks:     {len(webhooks)} total{f", {len([w for w in webhooks if 'ninetailed' in (w.get('name','')+w.get('url','')).lower()])} Ninetailed" if webhooks else ""}
""")

all_synced = (total_exp_match == len(nt_exp_ids) == len(cf_exp_map)
              and total_aud_match == len(nt_audiences) == len(cf_aud_map))

# Check if the stale IDs actually come from the Ninetailed environment
nt_env_resolves_stale = False
if nt_env_exp_map:
    stale_exp_ids = nt_exp_ids - set(cf_exp_map.keys())
    stale_resolved = stale_exp_ids & set(nt_env_exp_map.keys())
    if stale_resolved:
        nt_env_resolves_stale = True

if all_synced and not issues:
    print("  ✓  Everything is in sync!")
else:
    print("  ✗  Issues detected:")
    if not all_synced:
        print("     - Experience/audience IDs are out of sync between "
              "Contentful CDN and Ninetailed")
    if nt_env_resolves_stale:
        print(f"     - 'Stale' Ninetailed IDs actually match the '{nt_env_used}' "
              f"environment")
        print(f"       → Ninetailed is synced with '{nt_env_used}', "
              f"but app reads from '{CONTENTFUL_ENVIRONMENT}'")
        print(f"       → FIX: set CONTENTFUL_ENVIRONMENT={nt_env_used} "
              f"(or its alias) in .env")
    for issue in issues:
        first_line = issue.split("\n")[0]
        print(f"     - {first_line}")

print()
