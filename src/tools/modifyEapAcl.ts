import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { OmadaClient } from '../omadaClient/index.js';
import { siteInputSchema, toToolResult, wrapToolHandler } from '../server/common.js';

export function registerModifyEapAclTool(server: McpServer, client: OmadaClient): void {
    const inputSchema = siteInputSchema.extend({
        aclId: z.string().min(1, 'aclId is required (from listEapAcls)'),
        description: z.string().min(1).max(512).describe('Rule description (1-512 chars, no leading/trailing spaces).'),
        status: z.boolean().describe('Rule enabled status (false=disable, true=enable).'),
        policy: z.number().int().min(0).max(1).describe('0=drop, 1=allow.'),
        protocols: z.array(z.number().int()).describe('Protocol numbers — see Open API Access Guide section 5.5.'),
        sourceType: z.number().int().describe('0=network, 1=IP Group, 2=IP-Port Group, 4=SSID, 6=IPv6 Group, 7=IPv6-Port Group.'),
        sourceIds: z.array(z.string()).describe('Source IDs (depends on sourceType — e.g. LAN network IDs when sourceType=0).'),
        destinationType: z.number().int().describe('0=network, 1=IP Group, 2=IP-Port Group, 6=IPv6 Group, 7=IPv6-Port Group.'),
        destinationIds: z.array(z.string()).optional().describe('Destination IDs (depends on destinationType).'),
    });

    server.registerTool(
        'modifyEapAcl',
        {
            description:
                'Modify an EAP (access point) ACL rule by `aclId` (PUT, full-replacement semantics — supply the complete rule body). Required: description, status, policy, protocols, sourceType, sourceIds, destinationType. EAP rules are simpler than gateway rules — no direction/stateMode/syslog/timeRangeId fields. Use listEapAcls to discover existing rules first.',
            inputSchema: inputSchema.shape,
        },
        wrapToolHandler('modifyEapAcl', async (args) => {
            const { siteId, customHeaders, aclId, ...body } = args;
            return toToolResult(await client.modifyEapAcl(aclId, body, siteId, customHeaders));
        })
    );
}
