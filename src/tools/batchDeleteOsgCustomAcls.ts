import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { OmadaClient } from '../omadaClient/index.js';
import { siteInputSchema, toToolResult, wrapToolHandler } from '../server/common.js';

export function registerBatchDeleteOsgCustomAclsTool(server: McpServer, client: OmadaClient): void {
    const inputSchema = siteInputSchema.extend({
        selectType: z
            .enum(['all', 'include', 'exclude'])
            .describe(
                "Selection mode: 'all' processes every rule (ids ignored); 'include' processes only the listed ids; 'exclude' processes every rule except the listed ids."
            ),
        ids: z
            .array(z.string().min(1))
            .optional()
            .describe('Rule IDs from listOsgAcls. Required when selectType is include or exclude; ignored when selectType=all.'),
        searchKey: z.string().optional().describe('Optional fuzzy filter applied before selection.'),
    });

    server.registerTool(
        'batchDeleteOsgCustomAcls',
        {
            description:
                "Bulk-delete gateway (OSG) custom ACL rules. POST endpoint despite the name. `selectType` controls semantics: 'all' deletes every rule; 'include' deletes the listed ids; 'exclude' deletes every rule except the listed ids. Use listOsgAcls first to gather the ids you want to keep or delete.",
            inputSchema: inputSchema.shape,
        },
        wrapToolHandler('batchDeleteOsgCustomAcls', async (args) => {
            const { siteId, customHeaders, ...body } = args;
            return toToolResult(await client.batchDeleteOsgCustomAcls(body, siteId, customHeaders));
        })
    );
}
