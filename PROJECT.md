# Project Brief — Extending tplink-omada-mcp for Homelab Network-as-Code

> **Owner:** Rafael
> **Created:** 2026-05-11
> **Bootstrap doc for a new Claude Code session in this directory.**
> **Read order on session start:** PROJECT.md (this file) → SPEC.md → HANDOFF.md → fork/CLAUDE.md → fork/SPEC.md

---

## 1. Why this project exists

This is a **support project** for the parent homelab network/Proxmox upgrade at `/workspace/network/`. The parent project's Phase 2 cutover and ongoing operations (ACL iteration, schedule tweaks, IoT migration, IP group membership churn) require automated control over the TP-Link Omada SDN Controller. The existing MCP wrapper for Omada (MiguelTVMS/tplink-omada-mcp) covers extensive read operations but is essentially **read-only for write ops** — it has 287/1648 OpenAPI operations implemented per `OMADA_TOOLS.md`, and inspection reveals the "implemented" POSTs are actually GET-only tool files.

**Concrete pain points hit during Phase 1 Build (2026-05-08 to 2026-05-11):**

| Operation needed | Result without this project |
|---|---|
| Create SSID with VLAN binding | UI clicks, ~15 fields per SSID × 4 SSIDs |
| Create IP group | UI clicks (no API path tested) |
| Enable DHCP server on a network | Discovered Open API silently drops `dhcpSettings.enable=true` PATCH on networks that have no attached DHCP server entity — UI required |
| Update DHCP reservation | `updateClient` returns 405; UI required |
| Set client name (DHCP reservation label) | `updateClient` returns 405; UI required |
| Schedule SSID off-hours | Per-SSID nested schedule editor in UI |
| Create / update / delete ACL rules | Read tools exist but no write |
| Modify IP group membership (add/remove an IP) | Required when `IPG_INFRA` learns a new service |

For one-time setup (Phase 1 Build), UI was acceptable. For **recurring operations** in Phase 2 cutover and the multi-week IoT rotation tail, UI becomes a real productivity drag, and worse: it makes the network state non-reproducible.

**This project closes that gap by extending the Omada MCP with the missing write operations, all using the existing OAuth2 Open API surface (no new auth flows or admin-API integration).**

## 2. Current state — what's already done (2026-05-11)

A fork is at `/workspace/omada-mcp/fork/` on branch `feat/network-write-ops` with one commit shipped:

### ✅ Tier 0 — Infrastructure (DONE)

`RequestHandler` now has `post`, `put`, `delete` helpers (`src/omadaClient/request.ts`). Previously only `get`, `patch`, generic `request`, `fetchPaginated`, and `ensureSuccess` were exposed. **Every future write tool depends on these.** Excluded from coverage requirement per the project's CLAUDE.md.

### ✅ First Tier 1 deliverable — Group Profile CRUD (DONE)

Three operations on group profiles (IP, IP-Port, MAC, IPv6, IPv6-Port, Country, Domain — all 7 Omada types):

- `createGroupProfile(groupData, siteId?, customHeaders?)` → `POST /sites/{siteId}/profiles/groups`
- `updateGroupProfile(groupType, groupId, groupData, siteId?, customHeaders?)` → `PATCH /sites/{siteId}/profiles/groups/{groupType}/{groupId}`
- `deleteGroupProfile(groupType, groupId, siteId?, customHeaders?)` → `DELETE /sites/{siteId}/profiles/groups/{groupType}/{groupId}`

Implementation: `src/omadaClient/network.ts` (methods) + `src/omadaClient/index.ts` (delegations) + 3 tool files in `src/tools/` registered with category `profiles` permission `write`.

Tests: 17 new tool tests + 13 new omadaClient tests, **100% coverage** on the new code, full suite passes (2138/2138), lint clean.

Tool count went from 327 → 330. See `fork/SPEC.md` for the full operation roadmap and `HANDOFF.md` (one level up) for the live verification recipe + push instructions for your personal repo.

## 3. Gap inventory — what's still needed

Organized by tier (smaller tier = higher priority for our homelab use case).

### Tier 1 — Foundation writes (HIGH priority, ~3-4 hours of work)

These close the gaps directly hit during Phase 1 Build.

| # | Operation | Method + Path | Why we need it |
|---|---|---|---|
| 1.1 | `updateDhcpReservation` | `PATCH /sites/{siteId}/setting/service/dhcp/{mac}` | When a static-IP service moves or gets renamed |
| 1.2 | `deleteDhcpReservation` | `DELETE /sites/{siteId}/setting/service/dhcp/{mac}` | Clean up after retired services (e.g., old plex CT) |
| 1.3 | `updateClientName` | `PATCH /sites/{siteId}/clients/{clientMac}/name` | Replace the failed `updateClient` path; semantic device naming |
| 1.4 | `deleteLanNetwork` | `DELETE /sites/{siteId}/lan-networks/{networkId}` | Delete legacy `Default` VLAN 1 in Phase 3 |
| 1.5 | `deleteLanProfile` | `DELETE /sites/{siteId}/lan-profiles/{profileId}` | Cleanup after Phase 3 trunk profile reassignment |

**Note:** Group profile CRUD already shipped (3 ops), so total Tier 1 = the above 5 + 3 done = 8 operations.

### Tier 2 — ACL operations (HIGH priority, ~2-3 hours of work)

The recurring Phase 2 win. ACL rule iteration is the highest-frequency write workflow in our use case.

| # | Operation | Method + Path | Why we need it |
|---|---|---|---|
| 2.1 | `updateGatewayAcl` | `PUT /sites/{siteId}/acls/osg-acls/{aclId}` | Iterate gateway rules without delete-then-recreate |
| 2.2 | `updateEapAcl` | `PUT /sites/{siteId}/acls/eap-acls/{aclId}` | Iterate AP-side rules |
| 2.3 | `deleteAcl` | `DELETE /sites/{siteId}/acls/{aclId}` | Remove obsolete rules cleanly |
| 2.4 | `updateOswAcl` | `PUT /sites/{siteId}/acls/osw-acls/{aclId}` | (verify in OpenAPI — may not exist; switch ACL update path TBD) |
| 2.5 | `batchDeleteGatewayAcls` | `POST /sites/{siteId}/acls/gateway-acls/batch-delete` | Bulk cleanup |
| 2.6 | `modifyAclIndex` | `POST /sites/{siteId}/acls/modifyIndex` | Reorder rules (order = priority in Omada) |

ACL **create** already exists in upstream as `listOsgAcls` (POST handler under tool name `listOsgAcls` per OMADA_TOOLS.md, but verify against actual tool file — may be optimistic again).

### Tier 3 — Schedules (MEDIUM priority, ~2 hours of work)

For the Kids SSID and any future scheduled wireless behaviors.

| # | Operation | Method + Path |
|---|---|---|
| 3.1 | `createTimeRangeProfile` | `POST /sites/{siteId}/time-range-profile` (verify path in OpenAPI) |
| 3.2 | `updateTimeRangeProfile` | `PUT /sites/{siteId}/time-range-profile/{profileId}` |
| 3.3 | `deleteTimeRangeProfile` | `DELETE /sites/{siteId}/time-range-profile/{profileId}` |
| 3.4 | `createPortSchedule` | `POST /sites/{siteId}/port-schedules` |
| 3.5 | `updatePortSchedule` | `PUT /sites/{siteId}/port-schedules/{portScheduleId}` |
| 3.6 | `deletePortSchedule` | `DELETE /sites/{siteId}/port-schedules/{portScheduleId}` |
| 3.7 | `listPortSchedules` | `GET /sites/{siteId}/port-schedules` |

Useful for the Kids-2 SSID schedule we already configured manually, and for any future "office hours" / "guest party mode" type schedules.

### Tier 4 — SSID granular updates (MEDIUM priority, ~3 hours of work)

For modifying SSIDs after create — passwords, schedules, rate limits, mac filters.

| # | Operation | Method + Path |
|---|---|---|
| 4.1 | `updateSsidBasicConfig` | `PATCH /sites/{siteId}/wireless-network/wlans/{wlanId}/ssids/{ssidId}/update-basic-config` |
| 4.2 | `updateSsidMacFilter` | `PATCH /sites/{siteId}/wireless-network/wlans/{wlanId}/ssids/{ssidId}/update-mac-filter` |
| 4.3 | `updateSsidRateLimit` | `PATCH /sites/{siteId}/wireless-network/wlans/{wlanId}/ssids/{ssidId}/update-rate-limit` |
| 4.4 | `updateSsidWlanSchedule` | `PATCH /sites/{siteId}/wireless-network/wlans/{wlanId}/ssids/{ssidId}/update-wlan-schedule` |
| 4.5 | `updateSsidMulticastConfig` | `PATCH /sites/{siteId}/wireless-network/wlans/{wlanId}/ssids/{ssidId}/update-multicast-config` |
| 4.6 | `updateSsidRateControl` | `PATCH /sites/{siteId}/wireless-network/wlans/{wlanId}/ssids/{ssidId}/update-rate-control` |
| 4.7 | `updateSsidHotspotV2` | `PATCH /sites/{siteId}/wireless-network/wlans/{wlanId}/ssids/{ssidId}/update-hotspotv2` |
| 4.8 | `updateWlanGroup` | `PATCH /sites/{siteId}/wireless-network/wlans/{wlanId}` |

These are sub-resource patches (one per modifiable section of an SSID config). Implementing each is mechanical given the IP-group template.

### Tier 5 — Cleanup ops (LOW priority, ~1 hour)

Things that are nice but not urgent.

| # | Operation |
|---|---|
| 5.1 | `createLanVlansBatch` — bulk VLAN creation |
| 5.2 | `createLanDnsRule` — local DNS overrides |
| 5.3 | `deleteLanDnsRule` |
| 5.4 | `clearGatewayAclHitCounts` — analytics reset |

### Out of scope

These are intentionally NOT in this project:

| Item | Why not |
|---|---|
| **Device rename** | Not in Open API surface — admin-API only. Would need separate auth flow + version-fragile admin endpoints. UI is fine for the rare rename. |
| **Firmware upgrade** | Manual maintenance window; risky to automate. |
| **MSP / OLT / VOIP / site-templates / hotspot** | Massive surface (700+ ops in OMADA_TOOLS.md), zero homelab use case. |
| **`getFirmwareDetails`** (404 on Open API) | UI-only; check via mobile app. |
| **Admin API integration** (different auth flow) | Adds version-fragility + dual-auth complexity for marginal extra coverage. Open API gets us to 90%+ of real homelab needs. |

## 4. Use-case-driven prioritization

Map gaps to the homelab workflows that justify the work:

| Workflow | Required tiers | Time estimate to unblock |
|---|---|---|
| **Phase 2 cutover (one weekend)** | Tier 1 + Tier 2 | 5-7 hours of MCP work |
| **Slow IoT rotation tail (weeks)** | Tier 1 (mostly DHCP reservation update/delete) | 1-2 hours, included in Tier 1 |
| **Kids SSID schedule iteration** | Tier 3 (3.1-3.3 specifically) | 1-2 hours |
| **Adding a new VLAN tier** (e.g., CCTV, Printers) | Tier 1 + Tier 4 (1.1-1.3 + 4.1) | Already covered by Tier 1+4 |
| **Per-kid AdGuard buckets when kids have devices** | Tier 1 (1.1, 1.3) for DHCP labels | Already covered |
| **Periodic ACL audits + tuning** | Tier 2 (all) | Already covered by Tier 2 |
| **Sergio site Tailscale subnet router migration** | None (handled outside this MCP) | n/a |

**Recommended development order:**

1. **Tier 1 (5 ops, ~3h)** — closes immediate Phase 1 leftovers + unblocks Phase 2 staging
2. **Tier 2 (3-6 ops, ~3h)** — unlocks ACL iteration, the highest-recurrence workflow
3. **Tier 3 (3-7 ops, ~2h)** — Kids SSID schedule polish
4. **Tier 4 (8 ops, ~3h)** — full SSID lifecycle automation
5. **Tier 5 (4 ops, ~1h)** — opportunistic cleanup

**Total to "complete enough":** Tier 1 + 2 + 3 = ~8 hours of focused dev. Achievable in 2-3 evenings.

## 5. Architecture decisions (LOCKED — don't revisit without strong reason)

These were decided during 2026-05-11 analysis and shipped in the first commit.

### 5.1 Extend, don't fork-and-rewrite

The upstream MCP has good architecture (per-domain modules, mirror tests, biome lint, 100% coverage on new code, MCP inspector for live testing). Keep it. Add to it. Stay on the same branch model.

### 5.2 Open API only (no admin API)

Admin API has different auth (web username/password + cookie + CSRF), is undocumented, and changes between controller versions. Open API covers the gaps we care about (after this project). The one operation we know admin-API-only is **device rename** — accept UI for that.

### 5.3 Same Tier 0 infrastructure pattern

`post`, `put`, `delete` on RequestHandler. All future write tools call these. Don't add custom HTTP handling per tool.

### 5.4 Mirror tests strictly 1:1 with src

Per upstream's `CLAUDE.md`:
- Every `src/omadaClient/<name>.ts` (except `index.ts`) needs `tests/omadaClient/<name>.test.ts`
- Every `src/tools/<name>.ts` needs `tests/tools/<name>.test.ts`
- CI enforces via `scripts/check-tool-tests.mjs`

### 5.5 Coverage requirements

- Per-file: 90% lines/statements/functions
- Global: 70% branch coverage
- `src/omadaClient/request.ts`, `src/server/http.ts`, `src/server/stream.ts`, `src/omadaClient/index.ts` are excluded (infrastructure/bootstrap code)

### 5.6 Linting + formatting

- Biome 2.x
- 4-space indent, single quotes
- `npx biome check --write` to auto-fix
- CI fails on warnings (`--error-on-warnings`)

### 5.7 Tool registration convention

Each tool:
1. Exports a `register<ToolName>Tool(server, client)` function
2. Uses Zod 3 schema (Zod 4 not supported by MCP SDK yet)
3. Wraps handler with `wrapToolHandler('toolName', async (args) => toToolResult(await client.method(...)))`
4. Gets registered in `src/tools/index.ts` with category + permission tag
5. Tool count assertions in `tests/tools/index.test.ts` and `tests/toolCategories.test.ts` need to be bumped

### 5.8 Don't claim coverage in OMADA_TOOLS.md unless ACTUALLY implemented

The upstream OMADA_TOOLS.md has misleading statuses (claims POSTs implemented when only GET tool files exist). When updating OMADA_TOOLS.md status for new operations, match per-method coverage, not per-path. Consider proposing upstream a script that scans tool files for `request.post`/`.delete`/`.put` calls and updates status accurately.

## 6. Quality bar (must pass before any commit)

```bash
cd /workspace/omada-mcp/fork

# Lint clean
npx biome check src/ tests/                        # must show "No fixes applied" with no errors

# Typecheck clean
npx tsc --noEmit                                   # zero errors

# Full suite green
npm test                                           # all tests passing

# Coverage requirement
npm run test:coverage                              # no per-file or branch threshold violations
```

If any fails, fix before commit. CI will reject otherwise.

## 7. Reference materials

| File | Purpose |
|---|---|
| `/workspace/omada-mcp/PROJECT.md` | This file — project brief / bootstrap doc |
| `/workspace/omada-mcp/HANDOFF.md` | What's already shipped + live verification recipe + push instructions |
| `/workspace/omada-mcp/fork/SPEC.md` | Detailed implementation spec for each gap operation, with API paths + body shapes |
| `/workspace/omada-mcp/fork/CLAUDE.md` | Upstream's project conventions (stricter than the average TypeScript repo — read carefully) |
| `/workspace/omada-mcp/fork/OMADA_TOOLS.md` | Master tool tracker (1648 ops with API paths + OpenAPI source files) — caveat: status column is per-path not per-method, treat as roadmap not source of truth |
| `/workspace/omada-mcp/fork/docs/openapi/04-site-setting.json` | OpenAPI spec for most network ops (LAN, ACL, SSID, profiles) |
| `/workspace/omada-mcp/fork/docs/openapi/05-client.json` | OpenAPI spec for client name update etc. |
| `/workspace/omada-mcp/fork/src/tools/setClientRateLimit.ts` | Reference example of an existing write tool — mirror its pattern |
| `/workspace/omada-mcp/fork/src/tools/createGroupProfile.ts` | Reference example of a NEW write tool from this project |
| `/workspace/network/CLAUDE.md` | Parent project's lessons (Open API gaps documented from real-world hitting) |
| `/workspace/network/master-plan.md` | Parent project's master plan — explains where each op gets used |

## 8. How to bootstrap a new Claude Code session for this project

```bash
cd /workspace/omada-mcp/fork
# Verify state
git status                                          # should be clean on feat/network-write-ops
git log --oneline -3                                # confirm e2733a5 commit present
npm test                                            # confirm 2138 passing

# Tell Claude:
#   "I want to extend this MCP. Read PROJECT.md and SPEC.md first, then propose
#    the next operation to implement based on the priority order in PROJECT.md
#    section 4."
```

For each new operation, follow the template in HANDOFF.md section "Pattern for adding more operations". Estimated 30 min per operation including tests.

## 9. Success criteria

This project is "done enough" when:

- [ ] Tier 1 complete (5 remaining ops + the 3 already shipped) — closes Phase 1 leftovers
- [ ] Tier 2 complete (3-6 ops) — unlocks ACL iteration
- [ ] Tier 3 ops 3.1-3.3 (time-range profile CRUD) — Kids schedule iteration
- [ ] All quality gates passing (lint + typecheck + 90% coverage + full test suite green)
- [ ] One smoke test ran successfully against live controller (create+delete `_TEST_DELETE_ME` resources)
- [ ] Changes pushed to personal fork on GitHub
- [ ] **Optional** PR opened upstream to MiguelTVMS/tplink-omada-mcp

After that, Tier 4 / Tier 5 are nice-to-haves. Project can be paused or continued opportunistically.

## 10. Anti-goals — things to avoid

- ❌ **Don't build admin API integration** — different auth, version-fragile, marginal coverage gain
- ❌ **Don't try to implement all 1361 missing operations** — scope creep, vast majority have zero homelab use
- ❌ **Don't claim implementations in OMADA_TOOLS.md before they're tested** — the upstream's bad pattern that misled this project
- ❌ **Don't create tests that just check "schema exists"** — Zod refine validators need actual `.safeParse(...)` calls to count for coverage
- ❌ **Don't break existing tests** — tool count assertions in `tests/tools/index.test.ts` and `tests/toolCategories.test.ts` are routinely missed; bump them on every tool add
- ❌ **Don't dispatch agents for parallel implementation before the pattern is locked** — wait until Tier 1 has 2-3 done, then parallel agents can each implement one op safely

## 11. Risks + mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Upstream rejects PR | Low | Fork stays standalone in personal repo; project still useful |
| Upstream version bumps break our additions | Medium | Pin to a tag, sync periodically. Their CLAUDE.md is detailed; conventions stable. |
| OpenAPI specs drift between controller versions | Medium | Validate against your live controller's actual response shape; accept some `unknown` typing for edge fields |
| Live verification reveals the endpoints don't actually work as documented | Medium-low | Same risk as Tricade had; mitigated by going through OpenAPI specs that ship with this MCP (more reliable than guessing) + smoke testing each op against your controller before claiming "done" |
| Coverage thresholds make extending tedious | Low | The 90% per-file is achievable; pattern is locked; agents can do follow-on ops at ~30min/op |

## 12. License + ownership

Upstream is **MIT** (Copyright © 2025 João Miguel Tabosa Vaz Marques Silva). Fork rights are full. Modifications can be:
- Kept private in your personal repo
- Pushed to a personal public fork
- Submitted as PR upstream
- All three (public fork as default upstream-of-truth, personal use of branches)

If contributing back upstream, follow their PR template (likely in `.github/`). Their AI-collaborative development model (multiple AI agent contributors visible in git log) suggests they're receptive to AI-generated PRs.

---

**Bottom line:** ~8 hours of focused work spread over 2-3 evenings makes this MCP cover all real homelab use cases through Phase 3. The pattern is locked, the infrastructure is in place, the tests + coverage requirements are documented. A new Claude Code session reading this doc + SPEC.md should be productive within minutes.
