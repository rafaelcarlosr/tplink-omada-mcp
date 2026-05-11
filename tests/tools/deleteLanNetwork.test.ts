import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerDeleteLanNetworkTool } from '../../src/tools/deleteLanNetwork.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/deleteLanNetwork', () => {
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
            deleteLanNetwork: vi.fn(),
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

    describe('registerDeleteLanNetworkTool', () => {
        it('registers the deleteLanNetwork tool with correct schema', () => {
            registerDeleteLanNetworkTool(mockServer, mockClient);
            expect(mockServer.registerTool).toHaveBeenCalledWith('deleteLanNetwork', expect.any(Object), expect.any(Function));
        });

        it('deletes a LAN network with required networkId', async () => {
            const mockData = { success: true };
            (mockClient.deleteLanNetwork as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerDeleteLanNetworkTool(mockServer, mockClient);

            const result = await toolHandler({ networkId: 'net-1' }, { sessionId: 'test-session' });

            expect(mockClient.deleteLanNetwork).toHaveBeenCalledWith('net-1', undefined, undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('passes siteId when provided', async () => {
            (mockClient.deleteLanNetwork as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerDeleteLanNetworkTool(mockServer, mockClient);
            await toolHandler({ networkId: 'net-1', siteId: 'site-x' }, { sessionId: 'test-session' });
            expect(mockClient.deleteLanNetwork).toHaveBeenCalledWith('net-1', 'site-x', undefined);
        });

        it('passes customHeaders when provided', async () => {
            (mockClient.deleteLanNetwork as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerDeleteLanNetworkTool(mockServer, mockClient);
            await toolHandler({ networkId: 'net-1', customHeaders: { 'X-H': 'v' } }, { sessionId: 'test-session' });
            expect(mockClient.deleteLanNetwork).toHaveBeenCalledWith('net-1', undefined, { 'X-H': 'v' });
        });

        it('handles errors from the client', async () => {
            (mockClient.deleteLanNetwork as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Default LAN cannot be deleted.'));
            registerDeleteLanNetworkTool(mockServer, mockClient);
            await expect(toolHandler({ networkId: 'default-net' }, { sessionId: 'test-session' })).rejects.toThrow('Default LAN cannot be deleted.');
            expect(loggerModule.logger.error).toHaveBeenCalled();
        });
    });
});
