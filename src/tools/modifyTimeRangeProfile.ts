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
    dayType: z.number().int().min(0).max(7),
    startTimeH: z.number().int().min(0).max(24),
    startTimeM: z
        .number()
        .int()
        .refine((v) => v === 0 || v === 15 || v === 30 || v === 45, 'startTimeM must be 0, 15, 30, or 45'),
    endTimeH: z.number().int().min(0).max(24),
    endTimeM: z
        .number()
        .int()
        .refine((v) => v === 0 || v === 15 || v === 30 || v === 45, 'endTimeM must be 0, 15, 30, or 45'),
});

export function registerModifyTimeRangeProfileTool(server: McpServer, client: OmadaClient): void {
    const inputSchema = siteInputSchema.extend({
        profileId: z.string().min(1, 'profileId is required (from listTimeRangeProfiles)'),
        name: z.string().min(1).max(64).describe('Profile name (1-64 chars).'),
        dayMode: z.number().int().min(0).max(3).describe('0=Every Day, 1=Weekday, 2=Weekend, 3=Customized.'),
        customDayMode: customDayModeSchema.optional().describe('Per-day toggle map. Required when dayMode=3.'),
        timeList: z.array(scheduleTimeSchema).min(1).describe('Schedule windows; full replacement (PUT semantics).'),
    });

    server.registerTool(
        'modifyTimeRangeProfile',
        {
            description:
                'Modify an existing time range profile by `profileId` (PUT, full-replacement semantics — supply the complete profile body). Required: name, dayMode, timeList. customDayMode required when dayMode=3. Use listTimeRangeProfiles to discover existing profiles first.',
            inputSchema: inputSchema.shape,
        },
        wrapToolHandler('modifyTimeRangeProfile', async (args) => {
            const { siteId, customHeaders, profileId, ...body } = args;
            return toToolResult(await client.modifyTimeRangeProfile(profileId, body, siteId, customHeaders));
        })
    );
}
