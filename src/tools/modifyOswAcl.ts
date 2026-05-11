import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { OmadaClient } from '../omadaClient/index.js';
import { siteInputSchema, toToolResult, wrapToolHandler } from '../server/common.js';

const etherTypeSchema = z.object({
    enable: z.boolean().describe('Whether the ethertype filter is enabled.'),
    value: z
        .string()
        .regex(/^[0-9a-fA-F]{4}$/, 'ethertype value must be a 4-hex string (e.g. "0800")')
        .optional()
        .describe('4-hex ethertype. Required when enable=true. Only editable when both sourceType and destinationType are MAC Group.'),
});

const switchAclPortSchema = z.object({
    mac: z.string().min(1).describe('Switch MAC address.'),
    customPortIds: z.array(z.number().int()).describe('Custom port IDs on the switch.'),
    customLagIds: z.array(z.number().int()).describe('Custom LAG IDs on the switch.'),
});

export function registerModifyOswAclTool(server: McpServer, client: OmadaClient): void {
    const inputSchema = siteInputSchema.extend({
        aclId: z.string().min(1, 'aclId is required (from listOswAcls)'),
        description: z.string().min(1).max(512).describe('Rule description (1-512 chars, no leading/trailing spaces).'),
        status: z.boolean().describe('Rule enabled status (false=disable, true=enable).'),
        policy: z.number().int().min(0).max(1).describe('0=drop, 1=allow.'),
        protocols: z.array(z.number().int()).describe('Protocol numbers — see Open API Access Guide section 5.5.'),
        sourceType: z.number().int().describe('0=network, 1=IP Group, 2=IP-Port Group, 4=SSID, 6=IPv6 Group, 7=IPv6-Port Group.'),
        sourceIds: z.array(z.string()).describe('Source IDs (depends on sourceType — e.g. LAN network IDs when sourceType=0).'),
        destinationType: z.number().int().describe('0=network, 1=IP Group, 2=IP-Port Group, 6=IPv6 Group, 7=IPv6-Port Group.'),
        destinationIds: z.array(z.string()).optional().describe('Destination IDs (depends on destinationType).'),
        bindingType: z.number().int().min(0).max(2).describe('Where the rule applies: 0=all ports, 1=custom ports, 2=VLAN.'),
        customAclPorts: z.array(switchAclPortSchema).optional().describe('Custom ports/LAGs per switch. Only when bindingType=1.'),
        networkId: z.string().optional().describe('LAN network ID. Only when bindingType=2 (VLAN).'),
        bindingBridgeVlan: z.number().int().optional().describe('Bridge VLAN ID. Only when bindingType=2 and the network is a bridge VLAN.'),
        etherType: etherTypeSchema.describe('Ethertype filter. enable=false disables it.'),
        timeRangeId: z.string().optional().describe('Time-range profile ID; rule applies only during this schedule.'),
        biDirectional: z.boolean().optional().describe('Whether the rule is bidirectional. Required only when creating; safe to send on modify.'),
    });

    server.registerTool(
        'modifyOswAcl',
        {
            description:
                'Modify a switch (OSW) ACL rule by `aclId` (PUT, full-replacement semantics — supply the complete rule body). Switch ACLs are L2 rules with port/VLAN binding. Required: description, status, policy, protocols, sourceType, sourceIds, destinationType, bindingType, etherType. Use listOswAcls to discover existing rules first.',
            inputSchema: inputSchema.shape,
        },
        wrapToolHandler('modifyOswAcl', async (args) => {
            const { siteId, customHeaders, aclId, ...body } = args;
            return toToolResult(await client.modifyOswAcl(aclId, body, siteId, customHeaders));
        })
    );
}
