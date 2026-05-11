#!/usr/bin/env tsx
/**
 * Live smoke test for the write ops shipped on this branch.
 *
 * Runs against the controller in your .env. Default phases use only isolated
 * `_TEST_DELETE_ME` resources that are created + destroyed in the same run.
 * Risky phases (DHCP modify, client rename, ACL modify, SSID toggle) are
 * opt-in via flags and operate on resources YOU specify.
 *
 * Usage:
 *   npm run smoke-test                         # safe phases only
 *   npm run smoke-test -- --port-schedule      # + port schedule cycle
 *   npm run smoke-test -- --dhcp-mac=AA-BB-CC-11-22-33 --dhcp-netid=<id>
 *   npm run smoke-test -- --client-mac=AA-BB-CC-11-22-33
 *   npm run smoke-test -- --acl-id=<existing-osg-acl-id>
 *   npm run smoke-test -- --wlan-id=<id> --ssid-id=<id>
 *   npm run smoke-test -- --all                # run every safe phase
 *   npm run smoke-test -- --cleanup-only       # only delete leftover _TEST_DELETE_ME resources
 *
 * Exit code: 0 = all attempted phases passed; 1 = any failed.
 */
import '../src/env.js';
import { loadConfigFromEnv, type OmadaConnectionConfig } from '../src/config.js';
import { OmadaClient } from '../src/omadaClient/index.js';

const TEST_TAG = '_TEST_DELETE_ME';
const args = new Set(process.argv.slice(2));
const argMap = new Map<string, string>();
for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) argMap.set(m[1], m[2]);
}

const RUN_PORT_SCHEDULE = args.has('--port-schedule') || args.has('--all');
const DHCP_MAC = argMap.get('dhcp-mac');
const DHCP_NETID = argMap.get('dhcp-netid');
const CLIENT_MAC = argMap.get('client-mac');
const ACL_ID = argMap.get('acl-id');
const WLAN_ID = argMap.get('wlan-id');
const SSID_ID = argMap.get('ssid-id');
const CLEANUP_ONLY = args.has('--cleanup-only');

interface Result {
    name: string;
    ok: boolean;
    ms: number;
    error?: string;
}
const results: Result[] = [];

function pad(s: string, n: number): string {
    return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

async function phase<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
    const t0 = Date.now();
    process.stdout.write(`  ${pad(name, 50)} `);
    try {
        const value = await fn();
        const ms = Date.now() - t0;
        results.push({ name, ok: true, ms });
        process.stdout.write(`PASS  ${ms}ms\n`);
        return value;
    } catch (err) {
        const ms = Date.now() - t0;
        const message = err instanceof Error ? err.message : String(err);
        results.push({ name, ok: false, ms, error: message });
        process.stdout.write(`FAIL  ${ms}ms\n        ${message}\n`);
        return undefined;
    }
}

function header(s: string): void {
    process.stdout.write(`\n--- ${s} ---\n`);
}

interface GroupProfile {
    id?: string;
    groupId?: string;
    name?: string;
    type?: number;
}

interface TimeRangeProfile {
    id?: string;
    profileId?: string;
    name?: string;
}

interface PortSchedule {
    id?: string;
    name?: string;
}

interface DhcpReservation {
    mac?: string;
    netId?: string;
    ip?: string;
    status?: boolean;
    description?: string;
    [k: string]: unknown;
}

interface SsidDetail {
    name?: string;
    band?: number;
    broadcast?: boolean;
    guestNetEnable?: boolean;
    security?: number;
    vlanEnable?: boolean;
    vlanId?: number;
    mloEnable?: boolean;
    pmfMode?: number;
    enable11r?: boolean;
    [k: string]: unknown;
}

async function ensureCleanupSafe(client: OmadaClient): Promise<void> {
    header('Cleanup pass: removing any leftover _TEST_DELETE_ME resources');

    // IP group profiles (type=0)
    try {
        const groups = (await client.getGroupProfilesByType('0')) as { data?: GroupProfile[] } | GroupProfile[];
        const arr = Array.isArray(groups) ? groups : (groups?.data ?? []);
        for (const g of arr) {
            if (g.name?.startsWith(TEST_TAG) && (g.id || g.groupId)) {
                await phase(`delete leftover group ${g.name}`, async () => {
                    await client.deleteGroupProfile('0', (g.id ?? g.groupId) as string);
                });
            }
        }
    } catch (err) {
        process.stdout.write(`  (group profile cleanup skipped: ${err instanceof Error ? err.message : String(err)})\n`);
    }

    // Time range profiles
    try {
        const trs = (await client.listTimeRangeProfiles()) as TimeRangeProfile[];
        for (const t of trs ?? []) {
            if (t.name?.startsWith(TEST_TAG) && (t.id || t.profileId)) {
                await phase(`delete leftover time-range ${t.name}`, async () => {
                    await client.deleteTimeRangeProfile((t.id ?? t.profileId) as string);
                });
            }
        }
    } catch (err) {
        process.stdout.write(`  (time-range cleanup skipped: ${err instanceof Error ? err.message : String(err)})\n`);
    }

    // Port schedules
    try {
        const ps = (await client.listPortSchedules()) as PortSchedule[];
        for (const p of ps ?? []) {
            if (p.name?.startsWith(TEST_TAG) && p.id) {
                await phase(`delete leftover port-schedule ${p.name}`, async () => {
                    await client.deletePortSchedule(p.id as string);
                });
            }
        }
    } catch (err) {
        process.stdout.write(`  (port-schedule cleanup skipped: ${err instanceof Error ? err.message : String(err)})\n`);
    }
}

async function main(): Promise<void> {
    const config = loadConfigFromEnv();
    const omadaConfig: OmadaConnectionConfig = {
        baseUrl: config.baseUrl,
        clientId: config.clientId as string,
        clientSecret: config.clientSecret as string,
        omadacId: config.omadacId as string,
        siteId: config.siteId,
        strictSsl: config.strictSsl,
        requestTimeout: config.requestTimeout,
    };
    const client = new OmadaClient(omadaConfig);

    process.stdout.write(`Smoke test against ${config.baseUrl}\n`);
    process.stdout.write(`  site:    ${config.siteId ?? '(default from controller)'}\n`);
    process.stdout.write(`  omadac:  ${config.omadacId}\n`);

    if (CLEANUP_ONLY) {
        await ensureCleanupSafe(client);
        printSummary();
        return;
    }

    header('Phase 1 — Read baseline');
    await phase('listSites', async () => client.listSites());
    await phase('listGroupProfiles', async () => client.listGroupProfiles());
    await phase('listTimeRangeProfiles', async () => client.listTimeRangeProfiles());
    await phase('listPortSchedules', async () => client.listPortSchedules());
    await phase('listOsgAcls', async () => client.listOsgAcls());

    header('Phase 2 — Group profile CRUD (IP group, isolated)');
    let createdGroupId: string | undefined;
    await phase('createGroupProfile (IP group)', async () => {
        const res = (await client.createGroupProfile({
            name: TEST_TAG,
            type: 0,
            ipList: [{ ip: '192.168.99.0', mask: 24 }],
        })) as GroupProfile;
        createdGroupId = res.id ?? res.groupId;
        if (!createdGroupId) throw new Error('no id in response');
        return createdGroupId;
    });

    await phase('listGroupProfiles includes new group', async () => {
        const groups = (await client.getGroupProfilesByType('0')) as { data?: GroupProfile[] } | GroupProfile[];
        const arr = Array.isArray(groups) ? groups : (groups?.data ?? []);
        if (!arr.some((g) => g.name === TEST_TAG)) throw new Error('new group not in list');
    });

    if (createdGroupId) {
        await phase('updateGroupProfile (extend IP list)', async () =>
            client.updateGroupProfile('0', createdGroupId as string, {
                name: TEST_TAG,
                type: 0,
                ipList: [
                    { ip: '192.168.99.0', mask: 24 },
                    { ip: '10.99.0.0', mask: 16 },
                ],
            })
        );

        await phase('deleteGroupProfile', async () => client.deleteGroupProfile('0', createdGroupId as string));
        createdGroupId = undefined;
    }

    header('Phase 3 — Time-range profile CRUD (isolated)');
    let createdTrId: string | undefined;
    await phase('createTimeRangeProfile (Every Day 22-07)', async () => {
        const res = (await client.createTimeRangeProfile({
            name: TEST_TAG,
            dayMode: 0,
            timeList: [{ dayType: 0, startTimeH: 22, startTimeM: 0, endTimeH: 7, endTimeM: 0 }],
        })) as TimeRangeProfile;
        createdTrId = res.id ?? res.profileId;
        if (!createdTrId) throw new Error('no id in response');
    });

    if (createdTrId) {
        await phase('modifyTimeRangeProfile (shift to 21-07)', async () =>
            client.modifyTimeRangeProfile(createdTrId as string, {
                name: TEST_TAG,
                dayMode: 0,
                timeList: [{ dayType: 0, startTimeH: 21, startTimeM: 0, endTimeH: 7, endTimeM: 0 }],
            })
        );

        // Keep the time-range alive for the port-schedule phase if requested
        if (!RUN_PORT_SCHEDULE) {
            await phase('deleteTimeRangeProfile', async () => client.deleteTimeRangeProfile(createdTrId as string));
            createdTrId = undefined;
        }
    }

    if (RUN_PORT_SCHEDULE && createdTrId) {
        header('Phase 4 — Port schedule CRUD (depends on phase 3 time-range)');
        const portsMap: Record<string, number[]> = {};
        // ports are tied to actual switch MACs; user can override via env or accept the no-op behavior
        // (controller may accept empty portsMap; if it rejects, this phase fails harmlessly)
        portsMap['00-00-00-00-00-00'] = [];

        let createdPsId: string | undefined;
        await phase('createPortSchedule', async () => {
            const res = (await client.createPortSchedule({
                name: TEST_TAG,
                status: false,
                turnOnTime: createdTrId as string,
                portsMap,
            })) as PortSchedule;
            createdPsId = res.id;
            if (!createdPsId) throw new Error('no id in response');
        });

        if (createdPsId) {
            await phase('modifyPortSchedule', async () =>
                client.modifyPortSchedule(createdPsId as string, {
                    name: TEST_TAG,
                    status: false,
                    turnOnTime: createdTrId as string,
                    portsMap,
                })
            );
            await phase('deletePortSchedule', async () => client.deletePortSchedule(createdPsId as string));
        }
    }

    // Clean up phase-3 time-range if it was kept for phase 4
    if (createdTrId) {
        await phase('deleteTimeRangeProfile (post-port-schedule)', async () => client.deleteTimeRangeProfile(createdTrId as string));
        createdTrId = undefined;
    }

    if (DHCP_MAC) {
        header(`Phase 5 — DHCP reservation modify-revert on ${DHCP_MAC}`);
        if (!DHCP_NETID) {
            process.stdout.write('  --dhcp-mac given but --dhcp-netid missing; skipping\n');
        } else {
            let original: DhcpReservation | undefined;
            await phase('snapshot current reservation', async () => {
                const grid = (await client.getDhcpReservationGrid(1, 1000)) as { data?: DhcpReservation[] };
                original = grid?.data?.find((r) => r.mac === DHCP_MAC);
                if (!original) throw new Error(`no reservation found for ${DHCP_MAC}`);
            });

            if (original) {
                await phase('updateDhcpReservation (set description to _TEST_SMOKE)', async () =>
                    client.updateDhcpReservation(DHCP_MAC, {
                        netId: DHCP_NETID,
                        mac: DHCP_MAC,
                        ip: original?.ip,
                        status: original?.status ?? true,
                        description: '_TEST_SMOKE',
                    })
                );

                await phase('updateDhcpReservation (revert)', async () =>
                    client.updateDhcpReservation(DHCP_MAC, {
                        netId: DHCP_NETID,
                        mac: DHCP_MAC,
                        ip: original?.ip,
                        status: original?.status ?? true,
                        description: (original?.description as string) ?? '',
                    })
                );
            }
        }
    }

    if (CLIENT_MAC) {
        header(`Phase 6 — Client name modify-revert on ${CLIENT_MAC}`);
        let originalName: string | undefined;
        await phase('snapshot current client name', async () => {
            const c = (await client.getClientDetail(CLIENT_MAC)) as { name?: string };
            originalName = c?.name;
            if (originalName === undefined) throw new Error('cannot read current client name');
        });
        if (originalName !== undefined) {
            await phase('updateClientName (rename to _TEST_SMOKE)', async () => client.updateClientName(CLIENT_MAC, { name: '_TEST_SMOKE' }));
            await phase('updateClientName (revert)', async () => client.updateClientName(CLIENT_MAC, { name: originalName as string }));
        }
    }

    if (ACL_ID) {
        header(`Phase 7 — ACL modify on ${ACL_ID} (caller-supplied existing OSG rule)`);
        process.stdout.write('  WARNING: this PUTs to the existing rule. Make sure it is a test rule.\n');
        // Caller must hand us a body via a JSON env var to avoid us guessing.
        const bodyJson = process.env.SMOKE_ACL_BODY;
        if (!bodyJson) {
            process.stdout.write('  Set SMOKE_ACL_BODY (full GatewayACLConfig JSON) to run this phase. Skipping.\n');
        } else {
            const body = JSON.parse(bodyJson);
            await phase('modifyOsgAcl', async () => client.modifyOsgAcl(ACL_ID, body));
        }
    }

    if (WLAN_ID && SSID_ID) {
        header(`Phase 8 — SSID broadcast toggle (wlan=${WLAN_ID} ssid=${SSID_ID})`);
        process.stdout.write('  WARNING: this affects connected clients. Maintenance window only.\n');
        let detail: SsidDetail | undefined;
        await phase('snapshot SSID detail', async () => {
            detail = (await client.getSsidDetail(WLAN_ID, SSID_ID)) as SsidDetail;
        });
        if (detail) {
            const base = {
                name: detail.name as string,
                band: detail.band as number,
                broadcast: detail.broadcast as boolean,
                guestNetEnable: detail.guestNetEnable as boolean,
                security: detail.security as number,
                vlanEnable: detail.vlanEnable as boolean,
                vlanId: detail.vlanId as number | undefined,
                mloEnable: detail.mloEnable as boolean,
                pmfMode: detail.pmfMode as number,
                enable11r: detail.enable11r as boolean,
                pskSetting: detail.pskSetting,
                entSetting: detail.entSetting,
                ppskSetting: detail.ppskSetting,
                vlanSetting: detail.vlanSetting,
            };
            await phase('updateSsidBasicConfig (broadcast: false)', async () =>
                client.updateSsidBasicConfig(WLAN_ID, SSID_ID, { ...base, broadcast: false })
            );
            await phase('updateSsidBasicConfig (revert broadcast)', async () =>
                client.updateSsidBasicConfig(WLAN_ID, SSID_ID, { ...base, broadcast: detail?.broadcast as boolean })
            );
        }
    }

    await ensureCleanupSafe(client);
    printSummary();
}

function printSummary(): void {
    const total = results.length;
    const passed = results.filter((r) => r.ok).length;
    const failed = total - passed;
    const totalMs = results.reduce((acc, r) => acc + r.ms, 0);

    process.stdout.write(`\n${'='.repeat(60)}\n`);
    process.stdout.write(`Summary: ${passed}/${total} passed (${failed} failed) in ${totalMs}ms\n`);

    if (failed > 0) {
        process.stdout.write('\nFailures:\n');
        for (const r of results.filter((x) => !x.ok)) {
            process.stdout.write(`  - ${r.name}\n    ${r.error}\n`);
        }
        process.exitCode = 1;
    }
}

main().catch((err) => {
    process.stderr.write(`\nSmoke test crashed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
    process.exitCode = 1;
});
