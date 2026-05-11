import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { OmadaClient } from '../omadaClient/index.js';
import { siteInputSchema, toToolResult, wrapToolHandler } from '../server/common.js';

export function registerDeleteAclTool(server: McpServer, client: OmadaClient): void {
    const inputSchema = siteInputSchema.extend({
        aclId: z.string().min(1, 'aclId is required (see listOsgAcls / listEapAcls / listOswAcls)'),
    });

    server.registerTool(
        'deleteAcl',
        {
            description:
                'Delete an ACL rule by ID. The same endpoint covers gateway (osg), EAP, and switch (osw) ACLs — pass the `aclId` from the appropriate list call. Used for cleanup of obsolete rules during iterative rule tuning.',
            inputSchema: inputSchema.shape,
        },
        wrapToolHandler('deleteAcl', async ({ aclId, siteId, customHeaders }) => toToolResult(await client.deleteAcl(aclId, siteId, customHeaders)))
    );
}
