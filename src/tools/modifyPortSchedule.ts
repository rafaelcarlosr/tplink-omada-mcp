import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { OmadaClient } from '../omadaClient/index.js';
import { siteInputSchema, toToolResult, wrapToolHandler } from '../server/common.js';

const portsMapSchema = z.record(z.string().min(1), z.array(z.number().int().min(0)));

export function registerModifyPortScheduleTool(server: McpServer, client: OmadaClient): void {
    const inputSchema = siteInputSchema.extend({
        portScheduleId: z.string().min(1, 'portScheduleId is required (from listPortSchedules)'),
        name: z.string().min(1).max(128).describe('Schedule name (1-128 chars).'),
        status: z.boolean().describe('Whether the schedule is enabled.'),
        turnOnTime: z.string().min(1).describe('Time range profile ID.'),
        portsMap: portsMapSchema.describe('Map: switch MAC -> array of port IDs to schedule.'),
    });

    server.registerTool(
        'modifyPortSchedule',
        {
            description:
                'Modify a port schedule by `portScheduleId` (PUT, full-replacement — supply the complete body). Required body: name, status, turnOnTime, portsMap. Use listPortSchedules to discover existing schedules.',
            inputSchema: inputSchema.shape,
        },
        wrapToolHandler('modifyPortSchedule', async (args) => {
            const { siteId, customHeaders, portScheduleId, ...body } = args;
            return toToolResult(await client.modifyPortSchedule(portScheduleId, body, siteId, customHeaders));
        })
    );
}
