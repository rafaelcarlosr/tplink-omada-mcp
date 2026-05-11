import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { OmadaClient } from '../omadaClient/index.js';
import { siteInputSchema, toToolResult, wrapToolHandler } from '../server/common.js';

export function registerDeleteLanProfileTool(server: McpServer, client: OmadaClient): void {
    const inputSchema = siteInputSchema.extend({
        profileId: z.string().min(1, 'profileId is required (use getLanProfileList to discover existing profiles).'),
    });

    server.registerTool(
        'deleteLanProfile',
        {
            description:
                'Delete an existing LAN profile by profile ID. Use getLanProfileList to discover existing profiles. Cannot delete a profile currently assigned to an Easy Managed Switch (error -33560) — reassign the switch first.',
            inputSchema: inputSchema.shape,
        },
        wrapToolHandler('deleteLanProfile', async ({ profileId, siteId, customHeaders }) =>
            toToolResult(await client.deleteLanProfile(profileId, siteId, customHeaders))
        )
    );
}
