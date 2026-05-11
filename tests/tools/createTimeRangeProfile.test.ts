import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerCreateTimeRangeProfileTool } from '../../src/tools/createTimeRangeProfile.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/createTimeRangeProfile', () => {
    let mockServer: McpServer;
    let mockClient: OmadaClient;
    let toolHandler: (args: unknown, extra: { sessionId?: string }) => Promise<unknown>;

    const baseArgs = {
        name: 'Kids Wifi Off',
        dayMode: 0,
        timeList: [{ dayType: 0, startTimeH: 22, startTimeM: 0, endTimeH: 7, endTimeM: 0 }],
    };

    beforeEach(() => {
        mockServer = {
            registerTool: vi.fn((_name, _schema, handler) => {
                toolHandler = handler;
            }),
        } as unknown as McpServer;

        mockClient = {
            createTimeRangeProfile: vi.fn(),
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

    describe('registerCreateTimeRangeProfileTool', () => {
        it('registers the createTimeRangeProfile tool with correct schema', () => {
            registerCreateTimeRangeProfileTool(mockServer, mockClient);
            expect(mockServer.registerTool).toHaveBeenCalledWith('createTimeRangeProfile', expect.any(Object), expect.any(Function));
        });

        it('forwards args (minus site/headers) as the body', async () => {
            const mockData = { id: 'tr-1' };
            (mockClient.createTimeRangeProfile as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerCreateTimeRangeProfileTool(mockServer, mockClient);

            const result = await toolHandler(baseArgs, { sessionId: 'test-session' });

            expect(mockClient.createTimeRangeProfile).toHaveBeenCalledWith(baseArgs, undefined, undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('passes siteId when provided', async () => {
            (mockClient.createTimeRangeProfile as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerCreateTimeRangeProfileTool(mockServer, mockClient);
            await toolHandler({ ...baseArgs, siteId: 'site-x' }, { sessionId: 'test-session' });
            expect(mockClient.createTimeRangeProfile).toHaveBeenCalledWith(baseArgs, 'site-x', undefined);
        });

        it('passes customHeaders when provided', async () => {
            (mockClient.createTimeRangeProfile as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerCreateTimeRangeProfileTool(mockServer, mockClient);
            await toolHandler({ ...baseArgs, customHeaders: { 'X-H': 'v' } }, { sessionId: 'test-session' });
            expect(mockClient.createTimeRangeProfile).toHaveBeenCalledWith(baseArgs, undefined, { 'X-H': 'v' });
        });

        it('forwards customDayMode when dayMode=3', async () => {
            (mockClient.createTimeRangeProfile as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerCreateTimeRangeProfileTool(mockServer, mockClient);
            const customArgs = {
                name: 'Office Hours',
                dayMode: 3,
                customDayMode: { dayMon: true, dayTue: true, dayWed: true, dayThu: true, dayFri: true, daySat: false, daySun: false },
                timeList: [{ dayType: 1, startTimeH: 9, startTimeM: 0, endTimeH: 17, endTimeM: 0 }],
            };
            await toolHandler(customArgs, { sessionId: 'test-session' });
            expect(mockClient.createTimeRangeProfile).toHaveBeenCalledWith(customArgs, undefined, undefined);
        });

        it('rejects invalid minute via schema refine', async () => {
            const { z } = await import('zod');
            registerCreateTimeRangeProfileTool(mockServer, mockClient);
            const registerCall = (mockServer.registerTool as ReturnType<typeof vi.fn>).mock.calls[0];
            const schemaShape = registerCall[1].inputSchema as Record<string, z.ZodTypeAny>;
            const fullSchema = z.object(schemaShape);

            const badMinute = fullSchema.safeParse({
                ...baseArgs,
                timeList: [{ dayType: 0, startTimeH: 9, startTimeM: 7, endTimeH: 17, endTimeM: 0 }],
            });
            expect(badMinute.success).toBe(false);
            if (!badMinute.success) {
                expect(badMinute.error.issues[0].message).toContain('startTimeM must be 0, 15, 30, or 45');
            }

            const goodMinute = fullSchema.safeParse(baseArgs);
            expect(goodMinute.success).toBe(true);
        });

        it('handles errors from the client', async () => {
            (mockClient.createTimeRangeProfile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('This profile already exists.'));
            registerCreateTimeRangeProfileTool(mockServer, mockClient);
            await expect(toolHandler(baseArgs, { sessionId: 'test-session' })).rejects.toThrow('This profile already exists.');
            expect(loggerModule.logger.error).toHaveBeenCalled();
        });
    });
});
