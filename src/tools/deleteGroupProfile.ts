import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { OmadaClient } from '../omadaClient/index.js';
import { siteInputSchema, toToolResult, wrapToolHandler } from '../server/common.js';

export function registerDeleteGroupProfileTool(server: McpServer, client: OmadaClient): void {
    const inputSchema = siteInputSchema.extend({
        groupType: z
            .string()
            .min(1, 'groupType is required (string form: "0"=IP, "1"=IP-Port, "2"=MAC, "3"=IPv6, "4"=IPv6-Port, "5"=Country, "7"=Domain)'),
        groupId: z.string().min(1, 'groupId is required'),
    });

    server.registerTool(
        'deleteGroupProfile',
        {
            description:
                'Delete an existing group profile. Warning: any ACL rule referencing this group will be invalidated. Use listGroupProfiles or getGroupProfilesByType to find groupId.',
            inputSchema: inputSchema.shape,
        },
        wrapToolHandler('deleteGroupProfile', async ({ groupType, groupId, siteId, customHeaders }) =>
            toToolResult(await client.deleteGroupProfile(groupType, groupId, siteId, customHeaders))
        )
    );
}
