import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { OmadaClient } from '../omadaClient/index.js';
import { siteInputSchema, toToolResult, wrapToolHandler } from '../server/common.js';

export function registerDeletePortScheduleTool(server: McpServer, client: OmadaClient): void {
    const inputSchema = siteInputSchema.extend({
        portScheduleId: z.string().min(1, 'portScheduleId is required (from listPortSchedules)'),
    });

    server.registerTool(
        'deletePortSchedule',
        {
            description: 'Delete a port schedule by `portScheduleId`. Use listPortSchedules to discover existing schedules first.',
            inputSchema: inputSchema.shape,
        },
        wrapToolHandler('deletePortSchedule', async ({ portScheduleId, siteId, customHeaders }) =>
            toToolResult(await client.deletePortSchedule(portScheduleId, siteId, customHeaders))
        )
    );
}
