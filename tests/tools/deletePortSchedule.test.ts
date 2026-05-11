import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerDeletePortScheduleTool } from '../../src/tools/deletePortSchedule.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/deletePortSchedule', () => {
    let mockServer: McpServer;
    let mockClient: OmadaClient;
    let toolHandler: (args: unknown, extra: { sessionId?: string }) => Promise<unknown>;

    beforeEach(() => {
        mockServer = {
            registerTool: vi.fn((_name, _schema, handler) => {
                toolHandler = handler;
            }),
        } as unknown as McpServer;

        mockClient = {
            deletePortSchedule: vi.fn(),
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

    describe('registerDeletePortScheduleTool', () => {
        it('registers the tool', () => {
            registerDeletePortScheduleTool(mockServer, mockClient);
            expect(mockServer.registerTool).toHaveBeenCalledWith('deletePortSchedule', expect.any(Object), expect.any(Function));
        });

        it('deletes by ID', async () => {
            const mockData = { success: true };
            (mockClient.deletePortSchedule as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);
            registerDeletePortScheduleTool(mockServer, mockClient);
            const result = await toolHandler({ portScheduleId: 'ps-1' }, { sessionId: 'test-session' });
            expect(mockClient.deletePortSchedule).toHaveBeenCalledWith('ps-1', undefined, undefined);
            expect(result).toEqual({ content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }] });
        });

        it('passes siteId', async () => {
            (mockClient.deletePortSchedule as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerDeletePortScheduleTool(mockServer, mockClient);
            await toolHandler({ portScheduleId: 'ps-1', siteId: 'site-x' }, { sessionId: 'test-session' });
            expect(mockClient.deletePortSchedule).toHaveBeenCalledWith('ps-1', 'site-x', undefined);
        });

        it('passes customHeaders', async () => {
            (mockClient.deletePortSchedule as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerDeletePortScheduleTool(mockServer, mockClient);
            await toolHandler({ portScheduleId: 'ps-1', customHeaders: { 'X-H': 'v' } }, { sessionId: 'test-session' });
            expect(mockClient.deletePortSchedule).toHaveBeenCalledWith('ps-1', undefined, { 'X-H': 'v' });
        });

        it('handles errors', async () => {
            (mockClient.deletePortSchedule as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('not found'));
            registerDeletePortScheduleTool(mockServer, mockClient);
            await expect(toolHandler({ portScheduleId: 'ps-1' }, { sessionId: 'test-session' })).rejects.toThrow('not found');
            expect(loggerModule.logger.error).toHaveBeenCalled();
        });
    });
});
