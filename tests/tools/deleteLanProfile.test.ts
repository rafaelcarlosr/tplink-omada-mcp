import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerDeleteLanProfileTool } from '../../src/tools/deleteLanProfile.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/deleteLanProfile', () => {
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
            deleteLanProfile: vi.fn(),
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

    describe('registerDeleteLanProfileTool', () => {
        it('registers the deleteLanProfile tool with correct schema', () => {
            registerDeleteLanProfileTool(mockServer, mockClient);
            expect(mockServer.registerTool).toHaveBeenCalledWith('deleteLanProfile', expect.any(Object), expect.any(Function));
        });

        it('deletes a LAN profile with required profileId', async () => {
            const mockData = { success: true };
            (mockClient.deleteLanProfile as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerDeleteLanProfileTool(mockServer, mockClient);

            const result = await toolHandler({ profileId: 'profile-123' }, { sessionId: 'test-session' });

            expect(mockClient.deleteLanProfile).toHaveBeenCalledWith('profile-123', undefined, undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('passes siteId when provided', async () => {
            (mockClient.deleteLanProfile as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerDeleteLanProfileTool(mockServer, mockClient);
            await toolHandler({ profileId: 'profile-123', siteId: 'site-x' }, { sessionId: 'test-session' });
            expect(mockClient.deleteLanProfile).toHaveBeenCalledWith('profile-123', 'site-x', undefined);
        });

        it('passes customHeaders when provided', async () => {
            (mockClient.deleteLanProfile as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerDeleteLanProfileTool(mockServer, mockClient);
            await toolHandler({ profileId: 'profile-123', customHeaders: { 'X-H': 'v' } }, { sessionId: 'test-session' });
            expect(mockClient.deleteLanProfile).toHaveBeenCalledWith('profile-123', undefined, { 'X-H': 'v' });
        });

        it('handles errors from the client', async () => {
            (mockClient.deleteLanProfile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('This profile does not exist.'));
            registerDeleteLanProfileTool(mockServer, mockClient);
            await expect(toolHandler({ profileId: 'profile-missing' }, { sessionId: 'test-session' })).rejects.toThrow(
                'This profile does not exist.'
            );
            expect(loggerModule.logger.error).toHaveBeenCalled();
        });
    });
});
