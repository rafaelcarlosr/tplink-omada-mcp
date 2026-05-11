# tplink-omada-mcp — Network Write Operations Extension

> **Branch:** `feat/network-write-ops`
> **Goal:** add the missing Open API write operations needed for full network-as-code workflows.
> **Scope:** Only operations EXPOSED by the Open API but NOT yet implemented in this MCP. True admin-API-only ops (e.g., `device rename`) explicitly out of scope.

## Background

This MCP currently has **287 of 1648** Omada Open API operations implemented (per `OMADA_TOOLS.md`). Coverage is heavily skewed toward `getX` / `listX` (read). Phase 1 of a real homelab VLAN segmentation project hit these write gaps:

- IP groups CRUD — needed for ACL composition
- DHCP reservation update/delete — needed when re-numbering hosts
- Schedule CRUD — needed for time-bound SSIDs (e.g., kids' Wi-Fi off at night)
- ACL update + delete — needed for iterative rule tuning
- SSID granular updates — needed for post-create config tweaks
- Client name update — needed for device labeling
- LAN network/profile delete — cleanup ops

This branch closes those gaps. Each operation already exists in the controller's Open API per `docs/openapi/04-site-setting.json` and `05-client.json` — just not wrapped here yet.

## Operations in scope (Tier 1 — first PR)

### IP Group CRUD (4 ops)

Source: `04-site-setting.json` → `/sites/{siteId}/profiles/groups`

| Op | Method + Path | Status |
|---|---|---|
| `createIpGroup` | `POST /sites/{siteId}/profiles/groups` | New |
| `updateIpGroup` | `PATCH /sites/{siteId}/profiles/groups/{groupType}/{groupId}` | New |
| `deleteIpGroup` | `DELETE /sites/{siteId}/profiles/groups/{groupType}/{groupId}` | New |
| `listIpGroups` | `GET /sites/{siteId}/profiles/groups` | New (per-type list `getGroupProfilesByType` exists; this is all-types) |

Body schema: `CreateGroupOpenApiVO` (covers all 7 group types via `type` field: 0=IP, 1=IP-Port, 2=MAC, 3=IPv6, 4=IPv6-Port, 5=Country, 7=Domain). Fields conditional on `type` value — Zod schema enforces.

### DHCP Reservation Update + Delete (2 ops)

Source: `04-site-setting.json` → `/sites/{siteId}/setting/service/dhcp/{mac}`

| Op | Method + Path | Status |
|---|---|---|
| `updateDhcpReservation` | `PATCH /sites/{siteId}/setting/service/dhcp/{mac}` | New |
| `deleteDhcpReservation` | `DELETE /sites/{siteId}/setting/service/dhcp/{mac}` | New |

Create already implemented (under tool name `getDhcpReservationGrid` POST handler). Update + delete close the lifecycle.

### Client Name Update (1 op)

Source: `05-client.json` → `/sites/{siteId}/clients/{clientMac}/name`

| Op | Method + Path | Status |
|---|---|---|
| `updateClientName` | `PATCH /sites/{siteId}/clients/{clientMac}/name` | New |

Fixes the `updateClient` 405 errors observed when trying to label clients via Open API.

## Operations in scope (Tier 2 — follow-up PRs)

### Schedule CRUD (7 ops)

| Op | Method + Path |
|---|---|
| `createPortSchedule` | `POST /sites/{siteId}/port-schedules` |
| `updatePortSchedule` | `PUT /sites/{siteId}/port-schedules/{portScheduleId}` |
| `deletePortSchedule` | `DELETE /sites/{siteId}/port-schedules/{portScheduleId}` |
| `listPortSchedules` | `GET /sites/{siteId}/port-schedules` |
| `updateTimeRangeProfile` | `PUT /sites/{siteId}/time-range-profile/{profileId}` |
| `deleteTimeRangeProfile` | `DELETE /sites/{siteId}/time-range-profile/{profileId}` |
| `createNetworkReportSchedule` | `POST /sites/{siteId}/networkReport/schedule` |

Note: `time-range-profile` create endpoint not visible in OMADA_TOOLS.md sample — verify in OpenAPI spec.

### ACL Update + Delete (3 ops)

| Op | Method + Path |
|---|---|
| `updateGatewayAcl` | `PUT /sites/{siteId}/acls/osg-acls/{aclId}` |
| `updateEapAcl` | `PUT /sites/{siteId}/acls/eap-acls/{aclId}` |
| `deleteAcl` | `DELETE /sites/{siteId}/acls/{aclId}` |

ACL create + read for all three types (osg, osw, eap) already implemented.

### SSID Granular Updates (8 sub-PATCHes)

All on path `/sites/{siteId}/wireless-network/wlans/{wlanId}/ssids/{ssidId}/update-X`:

- `updateSsidBasicConfig`
- `updateSsidHotspotV2`
- `updateSsidMacFilter`
- `updateSsidMulticastConfig`
- `updateSsidRateControl`
- `updateSsidRateLimit`
- `updateSsidWlanSchedule`
- `updateSitesWirelessNetworkWlans` (modify WLAN group itself)

These are needed for post-create config tweaks. SSID create exists; granular updates don't.

### LAN Cleanup (3 ops)

| Op | Method + Path |
|---|---|
| `deleteLanNetwork` | `DELETE /sites/{siteId}/lan-networks/{networkId}` |
| `deleteLanProfile` | `DELETE /sites/{siteId}/lan-profiles/{profileId}` |
| `createLanVlansBatch` | `POST /sites/{siteId}/lan-vlans` (batch create) |

## Operations explicitly OUT of scope

| Op | Why not |
|---|---|
| Device rename | Not in Open API surface (admin-API only); requires separate auth flow |
| Firmware upgrade | Manual maintenance window; risky to automate |
| MSP / OLT / VOIP / site-templates / hotspot | Massive surface (700+ ops), no homelab use case |

## Architecture decision: extend, don't fork

Stay on Open API + existing OAuth2 client_credentials. Don't introduce admin-API client (different auth flow, version-fragile). The 287→~310 implemented operations covers the practical homelab gap.

## ⚠️ Discovered scope correction (2026-05-11)

The upstream `OMADA_TOOLS.md` claims "✅ Implemented" for many POST operations (createSsid, createDhcpReservation, listOsgAcls POST, etc.) but **inspection of actual tool files shows only GET handlers**. OMADA_TOOLS.md is path-coverage-based, not method-coverage-based — leading to a misleading status.

**Real state**:
- `RequestHandler` exposes only `get`, `patch`, `request` (generic), `fetchPaginated`, `ensureSuccess`
- **No `post`, `delete`, or `put` methods exist** as first-class helpers
- The only working write tools are `setClientRateLimit`, `setClientRateLimitProfile`, `disableClientRateLimit` — all PATCH-based
- Every claimed "POST implemented" in OMADA_TOOLS.md is, in reality, a GET-only tool

**Implication**: this PR needs to add infrastructure FIRST:

### Tier 0 — Infrastructure (this PR, FIRST)

| Addition | File | Why |
|---|---|---|
| `RequestHandler.post<T>(path, data?, customHeaders?)` | `src/omadaClient/request.ts` | Foundation for all create operations |
| `RequestHandler.put<T>(path, data?, customHeaders?)` | `src/omadaClient/request.ts` | Some Omada PUT updates (e.g., schedules) |
| `RequestHandler.delete<T>(path, customHeaders?)` | `src/omadaClient/request.ts` | All delete operations |
| Tests for above | `tests/omadaClient/request.test.ts` | Coverage requirement |

Each new method calls existing `this.request<T>({method, url: path, data})` — same auth + retry + logging path. Pure additive infrastructure.

### Then Tier 1 (this PR, SECOND)

Tier 1 implementations from above, using the new infrastructure.

## File layout (per project conventions)

Per CLAUDE.md: tests must mirror src 1:1.

```
src/
  omadaClient/
    profiles.ts         # NEW — IP groups + group profiles
    network.ts          # EXISTING — add deleteLanNetwork, updateDhcpReservation, deleteDhcpReservation
    client.ts           # EXISTING — add updateClientName
    schedules.ts        # EXISTING — add CRUD methods
    security.ts         # EXISTING — add updateGatewayAcl, updateEapAcl, deleteAcl
  tools/
    createIpGroup.ts    # NEW
    updateIpGroup.ts    # NEW
    deleteIpGroup.ts    # NEW
    listIpGroups.ts     # NEW
    updateClientName.ts # NEW
    updateDhcpReservation.ts # NEW
    deleteDhcpReservation.ts # NEW
    # (similar for tier 2 ops)
    index.ts            # MODIFIED — register all new tools
tests/
  omadaClient/
    profiles.test.ts    # NEW
    # (extend existing tests for added methods)
  tools/
    createIpGroup.test.ts # NEW (one per new tool)
    # ...
```

## Conventions to follow (from CLAUDE.md)

- Zod 3 schemas (Zod 4 not yet supported by MCP SDK)
- Each tool: `register<ToolName>Tool(server, client)` function exported
- Each tool: input validation via Zod, response wrapped via `toToolResult()`, handler wrapped via `wrapToolHandler()`
- Use `siteInputSchema.extend({...})` for site-aware tools
- 90% per-file coverage required (tests mirror src 1:1, CI enforces)
- Biome formatting (4-space indent, single quotes per existing files)
- TSDoc on public methods
- Never include validation logic outside `src/utils/config-validations.ts` or `src/config.ts`

## Auth + transport

All new ops use existing `OmadaClient` infrastructure:
- OAuth2 client_credentials flow (already implemented in `auth.ts`)
- `request.patch / post / delete / get` helpers (already in `request.ts`)
- `buildPath` helper for path construction (already wired)
- Same error mapping as existing tools

**No new infrastructure code needed.** All gaps are pure tool/method additions.

## Test strategy

Per CLAUDE.md:
- Vitest with `vi.mock` for HTTP layer
- Per-file coverage 90% minimum, branch coverage 70% global
- Each test verifies: schema validation rejects bad input, success response unwrapped correctly, error response surfaces error code + message, URL path constructed correctly with siteId resolution

## Live verification (user action — NOT done autonomously)

After merge, user runs against live controller:

1. **Safe creation test**: create a test IP group `_TEST_DELETE_ME`, verify list shows it, delete it, verify list no longer shows it.
2. **DHCP reservation test**: read existing reservations (already works), update one's name, verify, change back.
3. **Client name test**: rename a known client, verify in UI, rename back.

Do not test schedule CRUD or ACL CRUD against active config — risk too high. Build new test profiles, verify via API + UI, delete.

## Push instructions for user's repo

After review:
```bash
cd /workspace/omada-mcp/fork
git remote add origin git@github.com:<your-username>/tplink-omada-mcp.git  # or rename to omada-mcp
git push -u origin feat/network-write-ops
# Open PR upstream OR keep as personal fork
```

## Tier 1 implementation status (this PR)

| Operation | omadaClient method | Tool file | Tests | Status |
|---|---|---|---|---|
| createIpGroup | profiles.ts | createIpGroup.ts | profiles.test.ts + createIpGroup.test.ts | TODO |
| updateIpGroup | profiles.ts | updateIpGroup.ts | profiles.test.ts + updateIpGroup.test.ts | TODO |
| deleteIpGroup | profiles.ts | deleteIpGroup.ts | profiles.test.ts + deleteIpGroup.test.ts | TODO |
| listIpGroups | profiles.ts | listIpGroups.ts | profiles.test.ts + listIpGroups.test.ts | TODO |
| updateDhcpReservation | network.ts | updateDhcpReservation.ts | network.test.ts + updateDhcpReservation.test.ts | TODO |
| deleteDhcpReservation | network.ts | deleteDhcpReservation.ts | network.test.ts + deleteDhcpReservation.test.ts | TODO |
| updateClientName | client.ts | updateClientName.ts | client.test.ts + updateClientName.test.ts | TODO |

Each marked DONE as implemented + tested + lint-clean.
