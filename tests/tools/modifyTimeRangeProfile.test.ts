import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerModifyTimeRangeProfileTool } from '../../src/tools/modifyTimeRangeProfile.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/modifyTimeRangeProfile', () => {
    let mockServer: McpServer;
    let mockClient: OmadaClient;
    let toolHandler: (args: unknown, extra: { sessionId?: string }) => Promise<unknown>;

    const baseArgs = {
        profileId: 'tr-1',
        name: 'Kids Wifi Off',
        dayMode: 0,
        timeList: [{ dayType: 0, startTimeH: 21, startTimeM: 0, endTimeH: 7, endTimeM: 0 }],
    };

    const expectedBody = {
        name: baseArgs.name,
        dayMode: baseArgs.dayMode,
        timeList: baseArgs.timeList,
    };

    beforeEach(() => {
        mockServer = {
            registerTool: vi.fn((_name, _schema, handler) => {
                toolHandler = handler;
            }),
        } as unknown as McpServer;

        mockClient = {
            modifyTimeRangeProfile: vi.fn(),
        } as unknown as OmadaClient;

        vi.spyOn(loggerModule.logger, 'info').mockImplementation(() => {
            // noop
        });
        vi.spyOn(loggerModule.logger, 'error').mockImplementation(() => {
            // noop
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('registerModifyTimeRangeProfileTool', () => {
        it('registers the modifyTimeRangeProfile tool with correct schema', () => {
            registerModifyTimeRangeProfileTool(mockServer, mockClient);
            expect(mockServer.registerTool).toHaveBeenCalledWith('modifyTimeRangeProfile', expect.any(Object), expect.any(Function));
        });

        it('forwards profileId as path arg and the rest of args as body', async () => {
            const mockData = { id: 'tr-1' };
            (mockClient.modifyTimeRangeProfile as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerModifyTimeRangeProfileTool(mockServer, mockClient);

            const result = await toolHandler(baseArgs, { sessionId: 'test-session' });

            expect(mockClient.modifyTimeRangeProfile).toHaveBeenCalledWith('tr-1', expectedBody, undefined, undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('passes siteId when provided', async () => {
            (mockClient.modifyTimeRangeProfile as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerModifyTimeRangeProfileTool(mockServer, mockClient);
            await toolHandler({ ...baseArgs, siteId: 'site-x' }, { sessionId: 'test-session' });
            expect(mockClient.modifyTimeRangeProfile).toHaveBeenCalledWith('tr-1', expectedBody, 'site-x', undefined);
        });

        it('passes customHeaders when provided', async () => {
            (mockClient.modifyTimeRangeProfile as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerModifyTimeRangeProfileTool(mockServer, mockClient);
            await toolHandler({ ...baseArgs, customHeaders: { 'X-H': 'v' } }, { sessionId: 'test-session' });
            expect(mockClient.modifyTimeRangeProfile).toHaveBeenCalledWith('tr-1', expectedBody, undefined, { 'X-H': 'v' });
        });

        it('forwards customDayMode when dayMode=3', async () => {
            (mockClient.modifyTimeRangeProfile as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerModifyTimeRangeProfileTool(mockServer, mockClient);
            const customDayMode = { dayMon: true, dayTue: true, dayWed: true, dayThu: true, dayFri: true, daySat: false, daySun: false };
            await toolHandler({ ...baseArgs, dayMode: 3, customDayMode }, { sessionId: 'test-session' });
            expect(mockClient.modifyTimeRangeProfile).toHaveBeenCalledWith(
                'tr-1',
                { ...expectedBody, dayMode: 3, customDayMode },
                undefined,
                undefined
            );
        });

        it('rejects invalid endTimeM via schema refine', async () => {
            const { z } = await import('zod');
            registerModifyTimeRangeProfileTool(mockServer, mockClient);
            const registerCall = (mockServer.registerTool as ReturnType<typeof vi.fn>).mock.calls[0];
            const schemaShape = registerCall[1].inputSchema as Record<string, z.ZodTypeAny>;
            const fullSchema = z.object(schemaShape);

            const badEndMinute = fullSchema.safeParse({
                ...baseArgs,
                timeList: [{ dayType: 0, startTimeH: 9, startTimeM: 0, endTimeH: 17, endTimeM: 13 }],
            });
            expect(badEndMinute.success).toBe(false);
            if (!badEndMinute.success) {
                expect(badEndMinute.error.issues[0].message).toContain('endTimeM must be 0, 15, 30, or 45');
            }

            const goodMinutes = fullSchema.safeParse(baseArgs);
            expect(goodMinutes.success).toBe(true);
        });

        it('handles errors from the client', async () => {
            (mockClient.modifyTimeRangeProfile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('End time should be later than start time.'));
            registerModifyTimeRangeProfileTool(mockServer, mockClient);
            await expect(toolHandler(baseArgs, { sessionId: 'test-session' })).rejects.toThrow('End time should be later than start time.');
            expect(loggerModule.logger.error).toHaveBeenCalled();
        });
    });
});
