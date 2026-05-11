import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerModifyPortScheduleTool } from '../../src/tools/modifyPortSchedule.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/modifyPortSchedule', () => {
    let mockServer: McpServer;
    let mockClient: OmadaClient;
    let toolHandler: (args: unknown, extra: { sessionId?: string }) => Promise<unknown>;

    const baseArgs = {
        portScheduleId: 'ps-1',
        name: 'Office Hours Ports',
        status: false,
        turnOnTime: 'tr-1',
        portsMap: { 'AA-BB-CC-11-22-33': [1, 2] },
    };

    const expectedBody = {
        name: baseArgs.name,
        status: baseArgs.status,
        turnOnTime: baseArgs.turnOnTime,
        portsMap: baseArgs.portsMap,
    };

    beforeEach(() => {
        mockServer = {
            registerTool: vi.fn((_name, _schema, handler) => {
                toolHandler = handler;
            }),
        } as unknown as McpServer;

        mockClient = {
            modifyPortSchedule: vi.fn(),
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

    describe('registerModifyPortScheduleTool', () => {
        it('registers the tool', () => {
            registerModifyPortScheduleTool(mockServer, mockClient);
            expect(mockServer.registerTool).toHaveBeenCalledWith('modifyPortSchedule', expect.any(Object), expect.any(Function));
        });

        it('forwards portScheduleId + body', async () => {
            const mockData = { id: 'ps-1' };
            (mockClient.modifyPortSchedule as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);
            registerModifyPortScheduleTool(mockServer, mockClient);
            const result = await toolHandler(baseArgs, { sessionId: 'test-session' });
            expect(mockClient.modifyPortSchedule).toHaveBeenCalledWith('ps-1', expectedBody, undefined, undefined);
            expect(result).toEqual({ content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }] });
        });

        it('passes siteId', async () => {
            (mockClient.modifyPortSchedule as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerModifyPortScheduleTool(mockServer, mockClient);
            await toolHandler({ ...baseArgs, siteId: 'site-x' }, { sessionId: 'test-session' });
            expect(mockClient.modifyPortSchedule).toHaveBeenCalledWith('ps-1', expectedBody, 'site-x', undefined);
        });

        it('passes customHeaders', async () => {
            (mockClient.modifyPortSchedule as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerModifyPortScheduleTool(mockServer, mockClient);
            await toolHandler({ ...baseArgs, customHeaders: { 'X-H': 'v' } }, { sessionId: 'test-session' });
            expect(mockClient.modifyPortSchedule).toHaveBeenCalledWith('ps-1', expectedBody, undefined, { 'X-H': 'v' });
        });

        it('handles errors', async () => {
            (mockClient.modifyPortSchedule as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Invalid request parameters.'));
            registerModifyPortScheduleTool(mockServer, mockClient);
            await expect(toolHandler(baseArgs, { sessionId: 'test-session' })).rejects.toThrow('Invalid request parameters.');
            expect(loggerModule.logger.error).toHaveBeenCalled();
        });
    });
});
