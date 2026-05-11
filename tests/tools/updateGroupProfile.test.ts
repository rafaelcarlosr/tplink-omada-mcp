import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerUpdateGroupProfileTool } from '../../src/tools/updateGroupProfile.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/updateGroupProfile', () => {
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
            updateGroupProfile: vi.fn(),
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

    describe('registerUpdateGroupProfileTool', () => {
        it('registers the updateGroupProfile tool with correct schema', () => {
            registerUpdateGroupProfileTool(mockServer, mockClient);
            expect(mockServer.registerTool).toHaveBeenCalledWith('updateGroupProfile', expect.any(Object), expect.any(Function));
        });

        it('updates a group profile with required args', async () => {
            const mockData = { id: 'group-1', name: 'IPG_UPDATED', type: 0 };
            (mockClient.updateGroupProfile as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerUpdateGroupProfileTool(mockServer, mockClient);

            const result = await toolHandler(
                {
                    groupType: '0',
                    groupId: 'group-1',
                    name: 'IPG_UPDATED',
                    type: 0,
                    ipList: [{ ip: '10.0.0.0', mask: 8 }],
                },
                { sessionId: 'test-session' }
            );

            expect(mockClient.updateGroupProfile).toHaveBeenCalledWith(
                '0',
                'group-1',
                { name: 'IPG_UPDATED', type: 0, ipList: [{ ip: '10.0.0.0', mask: 8 }] },
                undefined,
                undefined
            );
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('passes siteId when provided', async () => {
            (mockClient.updateGroupProfile as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerUpdateGroupProfileTool(mockServer, mockClient);
            await toolHandler({ groupType: '2', groupId: 'g1', name: 'm', type: 2, siteId: 'site-x' }, { sessionId: 'test-session' });
            expect(mockClient.updateGroupProfile).toHaveBeenCalledWith('2', 'g1', { name: 'm', type: 2 }, 'site-x', undefined);
        });

        it('passes customHeaders when provided', async () => {
            (mockClient.updateGroupProfile as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerUpdateGroupProfileTool(mockServer, mockClient);
            await toolHandler({ groupType: '0', groupId: 'g1', name: 'x', type: 0, customHeaders: { 'X-H': 'v' } }, { sessionId: 'test-session' });
            expect(mockClient.updateGroupProfile).toHaveBeenCalledWith('0', 'g1', { name: 'x', type: 0 }, undefined, { 'X-H': 'v' });
        });

        it('handles errors from the client', async () => {
            (mockClient.updateGroupProfile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Group not found'));
            registerUpdateGroupProfileTool(mockServer, mockClient);
            await expect(toolHandler({ groupType: '0', groupId: 'g1', name: 'x', type: 0 }, { sessionId: 'test-session' })).rejects.toThrow(
                'Group not found'
            );
            expect(loggerModule.logger.error).toHaveBeenCalled();
        });
    });
});
