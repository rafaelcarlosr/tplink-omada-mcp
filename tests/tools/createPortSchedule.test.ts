import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerCreatePortScheduleTool } from '../../src/tools/createPortSchedule.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/createPortSchedule', () => {
    let mockServer: McpServer;
    let mockClient: OmadaClient;
    let toolHandler: (args: unknown, extra: { sessionId?: string }) => Promise<unknown>;

    const baseArgs = {
        name: 'Office Hours Ports',
        status: true,
        turnOnTime: 'tr-1',
        portsMap: { 'AA-BB-CC-11-22-33': [1, 2, 3] },
    };

    beforeEach(() => {
        mockServer = {
            registerTool: vi.fn((_name, _schema, handler) => {
                toolHandler = handler;
            }),
        } as unknown as McpServer;

        mockClient = {
            createPortSchedule: vi.fn(),
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

    describe('registerCreatePortScheduleTool', () => {
        it('registers the tool', () => {
            registerCreatePortScheduleTool(mockServer, mockClient);
            expect(mockServer.registerTool).toHaveBeenCalledWith('createPortSchedule', expect.any(Object), expect.any(Function));
        });

        it('forwards args (minus site/headers) as the body', async () => {
            const mockData = { id: 'ps-1' };
            (mockClient.createPortSchedule as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);
            registerCreatePortScheduleTool(mockServer, mockClient);
            const result = await toolHandler(baseArgs, { sessionId: 'test-session' });
            expect(mockClient.createPortSchedule).toHaveBeenCalledWith(baseArgs, undefined, undefined);
            expect(result).toEqual({ content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }] });
        });

        it('passes siteId when provided', async () => {
            (mockClient.createPortSchedule as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerCreatePortScheduleTool(mockServer, mockClient);
            await toolHandler({ ...baseArgs, siteId: 'site-x' }, { sessionId: 'test-session' });
            expect(mockClient.createPortSchedule).toHaveBeenCalledWith(baseArgs, 'site-x', undefined);
        });

        it('passes customHeaders when provided', async () => {
            (mockClient.createPortSchedule as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerCreatePortScheduleTool(mockServer, mockClient);
            await toolHandler({ ...baseArgs, customHeaders: { 'X-H': 'v' } }, { sessionId: 'test-session' });
            expect(mockClient.createPortSchedule).toHaveBeenCalledWith(baseArgs, undefined, { 'X-H': 'v' });
        });

        it('handles errors', async () => {
            (mockClient.createPortSchedule as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Invalid request parameters.'));
            registerCreatePortScheduleTool(mockServer, mockClient);
            await expect(toolHandler(baseArgs, { sessionId: 'test-session' })).rejects.toThrow('Invalid request parameters.');
            expect(loggerModule.logger.error).toHaveBeenCalled();
        });
    });
});
