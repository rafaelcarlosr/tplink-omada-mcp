import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { OmadaClient } from '../omadaClient/index.js';
import { siteInputSchema, toToolResult, wrapToolHandler } from '../server/common.js';

const portsMapSchema = z
    .record(z.string().min(1), z.array(z.number().int().min(0)))
    .describe('Map: switch MAC (uppercase, e.g. "AA-BB-CC-11-22-33") -> array of port IDs to schedule.');

export function registerCreatePortScheduleTool(server: McpServer, client: OmadaClient): void {
    const inputSchema = siteInputSchema.extend({
        name: z.string().min(1).max(128).describe('Schedule name (1-128 chars, no leading/trailing spaces).'),
        status: z.boolean().describe('Whether the schedule is enabled.'),
        turnOnTime: z.string().min(1).describe('Time range profile ID (see listTimeRangeProfiles).'),
        portsMap: portsMapSchema,
    });

    server.registerTool(
        'createPortSchedule',
        {
            description:
                'Create a port schedule (turns switch ports on/off according to a time range profile). Required: name, status, turnOnTime (time range profile ID from listTimeRangeProfiles), portsMap (switch MAC -> port IDs). Useful for off-hours port disable, weekend-only port enable, etc.',
            inputSchema: inputSchema.shape,
        },
        wrapToolHandler('createPortSchedule', async (args) => {
            const { siteId, customHeaders, ...body } = args;
            return toToolResult(await client.createPortSchedule(body, siteId, customHeaders));
        })
    );
}
