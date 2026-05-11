import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { OmadaClient } from '../omadaClient/index.js';
import { siteInputSchema, toToolResult, wrapToolHandler } from '../server/common.js';

export function registerModifyAclIndexTool(server: McpServer, client: OmadaClient): void {
    const inputSchema = siteInputSchema.extend({
        type: z.enum(['gateway', 'switch', 'eap']).describe('Which ACL family to reorder.'),
        indexes: z
            .record(z.string(), z.number().int().min(0))
            .describe(
                'Reorder map. Keys are ACL rule IDs (from listOsgAcls / listOswAcls / listEapAcls); values are the new priority indexes. Lower index = higher priority (index 0 is evaluated first). Include every rule you want at a specific position — the controller treats the map as the new ordering.'
            ),
    });

    server.registerTool(
        'modifyAclIndex',
        {
            description:
                "Reorder ACL rules. In Omada, rule order = priority — index 0 is evaluated first. Pass `type` ('gateway' | 'switch' | 'eap') to pick the ACL family, then a map from rule ID to its new index in `indexes`. Use this after listOsgAcls/listOswAcls/listEapAcls returns rules in an order that needs adjusting.",
            inputSchema: inputSchema.shape,
        },
        wrapToolHandler('modifyAclIndex', async (args) => {
            const { siteId, customHeaders, ...body } = args;
            return toToolResult(await client.modifyAclIndex(body, siteId, customHeaders));
        })
    );
}
