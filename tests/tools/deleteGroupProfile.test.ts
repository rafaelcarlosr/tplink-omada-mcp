import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerDeleteGroupProfileTool } from '../../src/tools/deleteGroupProfile.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/deleteGroupProfile', () => {
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
            deleteGroupProfile: vi.fn(),
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

    describe('registerDeleteGroupProfileTool', () => {
        it('registers the deleteGroupProfile tool with correct schema', () => {
            registerDeleteGroupProfileTool(mockServer, mockClient);
            expect(mockServer.registerTool).toHaveBeenCalledWith('deleteGroupProfile', expect.any(Object), expect.any(Function));
        });

        it('deletes a group profile with required args', async () => {
            const mockData = { success: true };
            (mockClient.deleteGroupProfile as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerDeleteGroupProfileTool(mockServer, mockClient);

            const result = await toolHandler({ groupType: '0', groupId: 'group-1' }, { sessionId: 'test-session' });

            expect(mockClient.deleteGroupProfile).toHaveBeenCalledWith('0', 'group-1', undefined, undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('passes siteId when provided', async () => {
            (mockClient.deleteGroupProfile as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerDeleteGroupProfileTool(mockServer, mockClient);
            await toolHandler({ groupType: '2', groupId: 'g1', siteId: 'site-x' }, { sessionId: 'test-session' });
            expect(mockClient.deleteGroupProfile).toHaveBeenCalledWith('2', 'g1', 'site-x', undefined);
        });

        it('passes customHeaders when provided', async () => {
            (mockClient.deleteGroupProfile as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerDeleteGroupProfileTool(mockServer, mockClient);
            await toolHandler({ groupType: '0', groupId: 'g1', customHeaders: { 'X-H': 'v' } }, { sessionId: 'test-session' });
            expect(mockClient.deleteGroupProfile).toHaveBeenCalledWith('0', 'g1', undefined, { 'X-H': 'v' });
        });

        it('handles errors from the client', async () => {
            (mockClient.deleteGroupProfile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Group not found'));
            registerDeleteGroupProfileTool(mockServer, mockClient);
            await expect(toolHandler({ groupType: '0', groupId: 'g1' }, { sessionId: 'test-session' })).rejects.toThrow('Group not found');
            expect(loggerModule.logger.error).toHaveBeenCalled();
        });
    });
});
