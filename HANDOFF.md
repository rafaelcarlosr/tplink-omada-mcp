# Omada MCP Extension — Handoff

> **Date:** 2026-05-11
> **Branch:** `feat/network-write-ops` (in `/workspace/omada-mcp/fork/`)
> **Status:** Tier 0 + first Tier 1 deliverable shipped + tested + lint-clean

## What was delivered

### Tier 0 — Infrastructure (RequestHandler write methods)

Added to `src/omadaClient/request.ts`:

- `RequestHandler.post<T>(path, data?, customHeaders?)` — for create operations
- `RequestHandler.put<T>(path, data?, customHeaders?)` — for some update endpoints (schedules)
- `RequestHandler.delete<T>(path, customHeaders?)` — for all delete operations

These call through the existing `this.request<T>(...)` generic so they get the same auth + retry + logging path. No code changes to auth, retry, or error mapping.

`request.ts` is on the coverage exclusion list per their `CLAUDE.md`, so no direct tests required for these primitives. They're exercised indirectly by every new write tool's unit test.

### Tier 1 (first deliverable) — Group Profile CRUD

Three new operations on `src/omadaClient/network.ts`:

- `createGroupProfile(groupData, siteId?, customHeaders?)` → `POST /sites/{siteId}/profiles/groups`
- `updateGroupProfile(groupType, groupId, groupData, siteId?, customHeaders?)` → `PATCH /sites/{siteId}/profiles/groups/{groupType}/{groupId}`
- `deleteGroupProfile(groupType, groupId, siteId?, customHeaders?)` → `DELETE /sites/{siteId}/profiles/groups/{groupType}/{groupId}`

Plus matching delegations on `OmadaClient` and 3 MCP tool files.

**Group types supported** (per Omada Open API enum):
- 0 = IP Group → uses `ipList`
- 1 = IP-Port Group → uses `ipList` + `portType` + `portList` / `portMaskList`
- 2 = MAC Group → uses `macAddressList`
- 3 = IPv6 Group → uses `ipv6List`
- 4 = IPv6-Port Group → uses `ipv6List` + `portType`
- 5 = Country Group → uses `countryList` + `description`
- 7 = Domain Group → uses `domainNamePort`

Tool registration: under category `profiles` with permission `write`. Tool count went from 327 → 330.

### Tests + quality

| | Result |
|---|---|
| Test suite | **2138 / 2138 passing** |
| Coverage | 100% on all new files (functions, lines, statements, branches) |
| Lint (biome) | **clean** |
| Typecheck (tsc) | **clean** |

Tests follow the established `vi.mock` pattern from `setClientRateLimit.test.ts`. Test files mirror src 1:1 as required by CI's `scripts/check-tool-tests.mjs`.

### SPEC document

`SPEC.md` at repo root — full roadmap of remaining write operations needed:

- **Tier 1 (next PRs):** DHCP reservation update + delete, client name update, more SSID granular updates
- **Tier 2:** Schedule CRUD (port schedules, time-range profiles, network-report schedule)
- **Tier 3:** ACL update + delete (PUT on osg-acls and eap-acls + DELETE)
- **Tier 4:** SSID 8 sub-PATCH endpoints (basic-config, hotspotv2, mac-filter, multicast, rate-control, rate-limit, wlan-schedule, WLAN group itself)
- **Tier 5:** LAN cleanup ops (delete LAN network, delete LAN profile, batch VLAN create)
- **Out of scope:** device rename (admin-API only, not in Open API surface), MSP/OLT/VOIP/site-templates/hotspot (no homelab use case)

## Important discovery (correction to OMADA_TOOLS.md)

The upstream `OMADA_TOOLS.md` claims many POST operations are "✅ Implemented" but inspection revealed they're path-coverage entries — the actual tool files only do GET. The MCP genuinely had **zero create/delete operations** before this PR. Anyone using OMADA_TOOLS.md as a roadmap should verify against the source files directly.

Worth fixing upstream: add a method dimension to OMADA_TOOLS.md status, or use a script that scans tool files for `request.post`/`.delete`/`.put` calls and updates status accurately.

## Live verification recipe (DO BEFORE MERGING)

I did not run any of these against the live controller — they need supervision because they'd write to real config. **Run these in order on a low-stakes timeslot.**

### Pre-flight

```bash
cd /workspace/omada-mcp/fork
npm install
npm test  # confirm 2138 passing
```

Set `.env.local` with your Omada credentials:
```
OMADA_BASE_URL=https://192.168.0.70
OMADA_CLIENT_ID=<your client id>
OMADA_CLIENT_SECRET=<your client secret>
OMADA_OMADAC_ID=29c97c581e5a3cbe17b0934e48bcd311
OMADA_SITE_ID=68d5964f8556da375ccdab44
OMADA_STRICT_SSL=false   # for self-signed dev environment
MCP_SERVER_LOG_LEVEL=debug
```

### Smoke test 1 — IP Group create / read / update / delete (the full lifecycle)

Run via MCP inspector (`npm run inspector`) OR via a Claude Code session with the MCP loaded.

1. **Create a throwaway IP group:**
   ```
   createGroupProfile({
     name: "_TEST_DELETE_ME",
     type: 0,
     ipList: [{ ip: "203.0.113.0", mask: 24 }]
   })
   ```
   Expect: success response with `{ id: "<new-id>" }`. Capture the ID.

2. **Verify it exists:**
   ```
   listGroupProfiles({ groupType: "0" })
   ```
   Should include `_TEST_DELETE_ME`.

3. **Update it:**
   ```
   updateGroupProfile({
     groupType: "0",
     groupId: "<id from step 1>",
     name: "_TEST_DELETE_ME",
     type: 0,
     ipList: [{ ip: "203.0.113.0", mask: 24 }, { ip: "198.51.100.0", mask: 24 }]
   })
   ```
   Expect: success.

4. **Delete it:**
   ```
   deleteGroupProfile({
     groupType: "0",
     groupId: "<id from step 1>"
   })
   ```
   Expect: success.

5. **Verify gone:**
   ```
   listGroupProfiles({ groupType: "0" })
   ```
   Should NOT include `_TEST_DELETE_ME`.

If all 5 steps pass: **the new write infrastructure works against your live controller**.

### Smoke test 2 — schema validation

Try to create with an invalid type:
```
createGroupProfile({ name: "x", type: 99 })
```
Expect: Zod schema rejects with message `type must be one of: 0=IP, 1=IP-Port, 2=MAC, 3=IPv6, 4=IPv6-Port, 5=Country, 7=Domain`.

### What to AVOID for verification

- ❌ Don't update or delete EXISTING IP groups (`IPG_DNS_SERVERS`, `IPG_INFRA`, `IPG_PROXMOX`, `IPG_TAILSCALE_TUNNEL`) — these are referenced by future ACL rules
- ❌ Don't create groups with realistic names — use `_TEST_DELETE_ME` prefix so any leftover is obvious
- ❌ Don't run schedule CRUD or ACL CRUD — those aren't in this PR yet, calling them will fail anyway

## Push instructions for your personal repo

Once verified:

```bash
cd /workspace/omada-mcp/fork
# Add your remote
git remote add origin git@github.com:<your-username>/<repo-name>.git
# OR if you want to keep upstream's name and add yours separately:
git remote rename upstream-origin upstream
git remote add origin git@github.com:<your-username>/<repo-name>.git

git push -u origin feat/network-write-ops
```

Then on GitHub:
- **Personal fork only**: just leave the branch in your repo
- **Upstream PR**: navigate to https://github.com/MiguelTVMS/tplink-omada-mcp/compare → select your fork's `feat/network-write-ops` → open PR
  - Title: `feat: add group profile CRUD + write-method infrastructure (post/put/delete)`
  - Body: paste sections from SPEC.md + the commit message
  - Note: this PR adds infrastructure many future write ops can build on, so it's high-impact but small scope — likely to be accepted

## Pattern for adding more operations (template)

The IP group CRUD is a clean template. To add (say) `updateDhcpReservation`:

1. **Add method to omadaClient module** (e.g., `network.ts`):
   ```ts
   public async updateDhcpReservation(mac: string, reservation: unknown, siteId?: string, customHeaders?: CustomHeaders): Promise<unknown> {
     const resolvedSiteId = this.site.resolveSiteId(siteId);
     const path = this.buildPath(`/sites/${encodeURIComponent(resolvedSiteId)}/setting/service/dhcp/${encodeURIComponent(mac)}`);
     const response = await this.request.patch<OmadaApiResponse<unknown>>(path, reservation, customHeaders);
     return this.request.ensureSuccess(response);
   }
   ```

2. **Add delegation to `OmadaClient`** (`src/omadaClient/index.ts`):
   ```ts
   public async updateDhcpReservation(mac: string, reservation: unknown, siteId?: string, customHeaders?: CustomHeaders): Promise<unknown> {
     return await this.networkOps.updateDhcpReservation(mac, reservation, siteId, customHeaders);
   }
   ```

3. **Create tool file** (`src/tools/updateDhcpReservation.ts`) — model after `updateGroupProfile.ts`.

4. **Register tool** in `src/tools/index.ts`:
   - Add import (alphabetical)
   - Add registry entry: `{ fn: registerUpdateDhcpReservationTool, category: 'network-lan', permission: 'write' }`
   - Bump tool count assertions in `tests/tools/index.test.ts` and `tests/toolCategories.test.ts` by +1

5. **Test files** (mirror src 1:1):
   - `tests/omadaClient/network.test.ts` — add a `describe('updateDhcpReservation')` block
   - `tests/tools/updateDhcpReservation.test.ts` — model after `tests/tools/updateGroupProfile.test.ts`

6. **Verify**:
   ```bash
   npm run check       # lint + typecheck
   npm test            # full suite
   npm run test:coverage  # 90% per-file required
   ```

7. **Update OMADA_TOOLS.md status** for the operation.

This template reliably produces CI-passing additions in ~30 min per operation.

## What should be done next (priority order if you continue)

1. **DHCP reservation update + delete** — small, useful, you already hit this gap
2. **Client name update** — replaces what we tried to do with `updateClient` (which 405s)
3. **ACL update + delete** — the recurring Phase 2 win
4. **Schedule CRUD** — for the Kids SSID and any future scheduled SSIDs
5. **SSID granular updates** — for non-create modifications

Each operation is ~30 min of work following the template above. With 4-6 hours of focused work, all of Tier 1 and Tier 2 could be in.

## Files changed in this PR

```
SPEC.md                                | NEW (roadmap doc)
src/omadaClient/request.ts             | +22 lines  (post/put/delete methods)
src/omadaClient/network.ts             | +55 lines  (3 group profile methods)
src/omadaClient/index.ts               | +18 lines  (3 delegations)
src/tools/createGroupProfile.ts        | NEW
src/tools/updateGroupProfile.ts        | NEW
src/tools/deleteGroupProfile.ts        | NEW
src/tools/index.ts                     | +6 lines   (imports + registry)
tests/omadaClient/network.test.ts      | +143 lines (13 new tests)
tests/tools/createGroupProfile.test.ts | NEW (7 tests)
tests/tools/updateGroupProfile.test.ts | NEW (5 tests)
tests/tools/deleteGroupProfile.test.ts | NEW (5 tests)
tests/tools/index.test.ts              | +1 line    (327→330 count)
tests/toolCategories.test.ts           | +2 lines   (327→330 in two places)
```

Net: 14 files, +963 / -4 lines. One commit, descriptive message.

## Closing thoughts

This is a clean, well-tested, ready-to-merge starter PR. The infrastructure work (post/put/delete on RequestHandler) is the load-bearing part — every future write tool depends on it. Once merged, additional CRUDs follow the template above and add value incrementally.

If upstream maintainer rejects the PR (unlikely given it's all additive + 100% coverage + standard patterns), the fork lives standalone in your repo and you can continue building.

Verification path is in this doc. Push path is in this doc. Pattern for extending is in this doc. You're set.
