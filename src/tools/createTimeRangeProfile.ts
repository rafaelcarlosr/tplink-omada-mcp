import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { OmadaClient } from '../omadaClient/index.js';
import { siteInputSchema, toToolResult, wrapToolHandler } from '../server/common.js';

const customDayModeSchema = z.object({
    dayMon: z.boolean(),
    dayTue: z.boolean(),
    dayWed: z.boolean(),
    dayThu: z.boolean(),
    dayFri: z.boolean(),
    daySat: z.boolean(),
    daySun: z.boolean(),
});

const scheduleTimeSchema = z.object({
    dayType: z.number().int().min(0).max(7).describe('1-7 = Monday-Sunday when dayMode=3. Use 0 when dayMode is 0/1/2.'),
    startTimeH: z.number().int().min(0).max(24).describe('Start hour (0-24).'),
    startTimeM: z
        .number()
        .int()
        .refine((v) => v === 0 || v === 15 || v === 30 || v === 45, 'startTimeM must be 0, 15, 30, or 45'),
    endTimeH: z.number().int().min(0).max(24).describe('End hour (0-24).'),
    endTimeM: z
        .number()
        .int()
        .refine((v) => v === 0 || v === 15 || v === 30 || v === 45, 'endTimeM must be 0, 15, 30, or 45'),
});

export function registerCreateTimeRangeProfileTool(server: McpServer, client: OmadaClient): void {
    const inputSchema = siteInputSchema.extend({
        name: z.string().min(1).max(64).describe('Profile name (1-64 chars, no leading/trailing spaces).'),
        dayMode: z.number().int().min(0).max(3).describe('0=Every Day, 1=Weekday, 2=Weekend, 3=Customized.'),
        customDayMode: customDayModeSchema.optional().describe('Per-day toggle map. Required when dayMode=3; ignored otherwise.'),
        timeList: z
            .array(scheduleTimeSchema)
            .min(1, 'timeList is required (at least one window)')
            .describe('Schedule windows. End time must be after start time.'),
    });

    server.registerTool(
        'createTimeRangeProfile',
        {
            description:
                'Create a new time range profile (schedule for SSIDs, ACLs, port schedules, PoE schedules, etc.). Required: name, dayMode, timeList. customDayMode is required when dayMode=3 (Customized). Schedule minute fields must be one of {0, 15, 30, 45}. Endpoint path uses `/time-range-profiles` (plural) for create; modify/delete use the singular path.',
            inputSchema: inputSchema.shape,
        },
        wrapToolHandler('createTimeRangeProfile', async (args) => {
            const { siteId, customHeaders, ...body } = args;
            return toToolResult(await client.createTimeRangeProfile(body, siteId, customHeaders));
        })
    );
}
