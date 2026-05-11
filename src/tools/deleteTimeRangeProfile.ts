import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { OmadaClient } from '../omadaClient/index.js';
import { siteInputSchema, toToolResult, wrapToolHandler } from '../server/common.js';

export function registerDeleteTimeRangeProfileTool(server: McpServer, client: OmadaClient): void {
    const inputSchema = siteInputSchema.extend({
        profileId: z.string().min(1, 'profileId is required (from listTimeRangeProfiles)'),
    });

    server.registerTool(
        'deleteTimeRangeProfile',
        {
            description:
                'Delete a time range profile by `profileId`. Deletion fails if the profile is referenced by an SSID, ACL, port schedule, PoE schedule, IPS rule, or DPI rule — clear those references first.',
            inputSchema: inputSchema.shape,
        },
        wrapToolHandler('deleteTimeRangeProfile', async ({ profileId, siteId, customHeaders }) =>
            toToolResult(await client.deleteTimeRangeProfile(profileId, siteId, customHeaders))
        )
    );
}
