import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerUpdateClientNameTool } from '../../src/tools/updateClientName.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/updateClientName', () => {
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
            updateClientName: vi.fn(),
        } as unknown as OmadaClient;

        vi.spyOn(loggerModule.logger, 'info').mockImplementation(() => {
            // Mock implementation
        });
        vi.spyOn(loggerModule.logger, 'error').mockImplementation(() => {
            // Mock implementation
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('registerUpdateClientNameTool', () => {
        it('should register the updateClientName tool with correct schema', () => {
            registerUpdateClientNameTool(mockServer, mockClient);
            expect(mockServer.registerTool).toHaveBeenCalledWith('updateClientName', expect.any(Object), expect.any(Function));
        });

        it('should execute successfully with required args', async () => {
            const mockData = { success: true };
            (mockClient.updateClientName as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerUpdateClientNameTool(mockServer, mockClient);

            const result = await toolHandler({ clientMac: 'AA:BB:CC:DD:EE:FF', name: 'Living Room TV' }, { sessionId: 'test-session' });

            expect(mockClient.updateClientName).toHaveBeenCalledWith('AA:BB:CC:DD:EE:FF', { name: 'Living Room TV' }, undefined, undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('should pass siteId when provided', async () => {
            const mockData = { success: true };
            (mockClient.updateClientName as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerUpdateClientNameTool(mockServer, mockClient);

            await toolHandler({ clientMac: 'AA:BB:CC:DD:EE:FF', name: 'Renamed', siteId: 'test-site' }, { sessionId: 'test-session' });

            expect(mockClient.updateClientName).toHaveBeenCalledWith('AA:BB:CC:DD:EE:FF', { name: 'Renamed' }, 'test-site', undefined);
        });

        it('should pass customHeaders when provided', async () => {
            const mockData = { success: true };
            const customHeaders = { 'X-Custom': 'header' };
            (mockClient.updateClientName as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerUpdateClientNameTool(mockServer, mockClient);

            await toolHandler(
                { clientMac: 'AA:BB:CC:DD:EE:FF', name: 'My Phone', siteId: 'test-site', customHeaders },
                { sessionId: 'test-session' }
            );

            expect(mockClient.updateClientName).toHaveBeenCalledWith('AA:BB:CC:DD:EE:FF', { name: 'My Phone' }, 'test-site', customHeaders);
        });

        it('should handle errors from the client', async () => {
            const error = new Error('This client does not exist.');
            (mockClient.updateClientName as ReturnType<typeof vi.fn>).mockRejectedValue(error);

            registerUpdateClientNameTool(mockServer, mockClient);

            await expect(toolHandler({ clientMac: 'AA:BB:CC:DD:EE:FF', name: 'X' }, { sessionId: 'test-session' })).rejects.toThrow(
                'This client does not exist.'
            );

            expect(loggerModule.logger.error).toHaveBeenCalledWith('Tool failed', {
                tool: 'updateClientName',
                sessionId: 'test-session',
                error: 'This client does not exist.',
            });
        });
    });
});
