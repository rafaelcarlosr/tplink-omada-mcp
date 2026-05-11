import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { OmadaClient } from '../omadaClient/index.js';
import { siteInputSchema, toToolResult, wrapToolHandler } from '../server/common.js';

// Nested security/VLAN settings carry many security-mode-conditional fields.
// We accept them as opaque objects rather than mirror every conditional shape —
// the controller validates them server-side. Documented per security mode in
// the tool description.
const passthroughObjectSchema = z.record(z.string(), z.unknown());

export function registerUpdateSsidBasicConfigTool(server: McpServer, client: OmadaClient): void {
    const inputSchema = siteInputSchema.extend({
        wlanId: z.string().min(1, 'wlanId is required (from getWlanGroupList)'),
        ssidId: z.string().min(1, 'ssidId is required (from getSsidList)'),
        name: z.string().min(1).max(32).describe('SSID name (1-32 UTF-8 chars).'),
        band: z.number().int().min(1).max(7).describe('Band bitmask: 1=2.4G, 2=5G, 4=6G. Combine via OR — e.g. 7 means all three; 3 means 2.4G+5G.'),
        broadcast: z.boolean().describe('Broadcast the SSID name (hidden network if false).'),
        guestNetEnable: z.boolean().describe('Whether this SSID is a guest network (client isolation, no LAN access).'),
        security: z.number().int().describe('0=None, 2=WPA-Enterprise, 3=WPA-Personal, 4=PPSK without RADIUS, 5=PPSK with RADIUS.'),
        vlanEnable: z.boolean().describe('Bind clients of this SSID to a VLAN.'),
        vlanId: z.number().int().min(1).max(4094).optional().describe('VLAN ID, required when vlanEnable=true (1-4094).'),
        mloEnable: z.boolean().describe('Multi-Link Operation (Wi-Fi 7).'),
        pmfMode: z.number().int().min(1).max(3).describe('PMF: 1=Mandatory, 2=Capable, 3=Disable.'),
        enable11r: z.boolean().describe('802.11r fast roaming.'),
        oweEnable: z.boolean().optional().describe('Enhanced Open / WPA3-OWE. Only valid when security=0 and band includes 2.4G or 5G.'),
        hidePwd: z.boolean().optional().describe('Hide the WPA password in API responses.'),
        greEnable: z.boolean().optional().describe('EoGRE tunnel. Requires the global EoGRE config to be enabled.'),
        prohibitWifiShare: z.boolean().optional().describe('Prevent clients from sharing the Wi-Fi password.'),
        pskSetting: passthroughObjectSchema.optional().describe('WPA-Personal settings (passphrase, encryption). Required when security=3.'),
        entSetting: passthroughObjectSchema.optional().describe('WPA-Enterprise settings (RADIUS profile). Required when security=2.'),
        ppskSetting: passthroughObjectSchema.optional().describe('PPSK settings (PPSK profile, RADIUS, etc.). Required when security=4 or 5.'),
        vlanSetting: passthroughObjectSchema.optional().describe('Advanced VLAN settings (e.g. per-band VLAN override).'),
    });

    server.registerTool(
        'updateSsidBasicConfig',
        {
            description:
                "Update an SSID's basic config (name, band, security mode, VLAN binding, broadcast, MLO, PMF, etc.). PATCH endpoint on a sub-resource — sends the full basic-config body, NOT a partial. Required: name, band, broadcast, enable11r, guestNetEnable, mloEnable, pmfMode, security, vlanEnable. Security-conditional: pskSetting (security=3), entSetting (security=2), ppskSetting (security=4/5). VLAN-conditional: vlanId or vlanSetting (vlanEnable=true). The controller validates the conditional sub-objects server-side.",
            inputSchema: inputSchema.shape,
        },
        wrapToolHandler('updateSsidBasicConfig', async (args) => {
            const { siteId, customHeaders, wlanId, ssidId, ...body } = args;
            return toToolResult(await client.updateSsidBasicConfig(wlanId, ssidId, body, siteId, customHeaders));
        })
    );
}
