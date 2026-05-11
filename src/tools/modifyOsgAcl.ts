import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { OmadaClient } from '../omadaClient/index.js';
import { siteInputSchema, toToolResult, wrapToolHandler } from '../server/common.js';

const gatewayDirectionSchema = z.object({
    lanToWan: z.boolean().optional().describe('LAN->WAN direction'),
    lanToLan: z.boolean().optional().describe('LAN->LAN direction (conflicts with other directions)'),
    wanInIds: z.array(z.string()).optional().describe('Selected WAN port IDs'),
    vpnInIds: z.array(z.string()).optional().describe('Selected VPN IDs'),
});

const gatewayAclStatesSchema = z.object({
    stateNew: z.boolean().optional(),
    established: z.boolean().optional(),
    related: z.boolean().optional(),
    invalid: z.boolean().optional(),
});

export function registerModifyOsgAclTool(server: McpServer, client: OmadaClient): void {
    const inputSchema = siteInputSchema.extend({
        aclId: z.string().min(1, 'aclId is required (from listOsgAcls)'),
        description: z.string().min(1).max(512).describe('Rule description (1-512 chars, no leading/trailing spaces).'),
        status: z.boolean().describe('Rule enabled status (false=disable, true=enable).'),
        policy: z.number().int().min(0).max(1).describe('0=drop, 1=allow.'),
        protocols: z.array(z.number().int()).describe('Protocol numbers — see Open API Access Guide section 5.5.'),
        sourceType: z.number().int().describe('0=network, 1=IP Group, 2=IP-Port Group, 4=SSID, 6=IPv6 Group, 7=IPv6-Port Group.'),
        sourceIds: z.array(z.string()).describe('Source IDs (depends on sourceType — e.g. LAN network IDs when sourceType=0).'),
        destinationType: z.number().int().describe('0=network, 1=IP Group, 2=IP-Port Group, 6=IPv6 Group, 7=IPv6-Port Group, 10=Domain Group.'),
        destinationIds: z.array(z.string()).optional().describe('Destination IDs (depends on destinationType).'),
        direction: gatewayDirectionSchema.describe('LAN/WAN/VPN direction selectors (Gateway only).'),
        stateMode: z.number().int().min(0).max(1).describe('0=auto, 1=manual.'),
        states: gatewayAclStatesSchema.optional().describe('Connection-state matching (only when stateMode=1).'),
        syslog: z.boolean().describe('Send rule hits to remote syslog.'),
        timeRangeId: z.string().optional().describe('Time-range profile ID; rule applies only during this schedule.'),
    });

    server.registerTool(
        'modifyOsgAcl',
        {
            description:
                'Modify a gateway (OSG) ACL rule by `aclId` (PUT, full-replacement semantics — supply the complete rule body, not a partial patch). Required: description, status, policy, protocols, sourceType, sourceIds, destinationType, direction, stateMode, syslog. Use listOsgAcls to discover existing rules first.',
            inputSchema: inputSchema.shape,
        },
        wrapToolHandler('modifyOsgAcl', async (args) => {
            const { siteId, customHeaders, aclId, ...body } = args;
            return toToolResult(await client.modifyOsgAcl(aclId, body, siteId, customHeaders));
        })
    );
}
