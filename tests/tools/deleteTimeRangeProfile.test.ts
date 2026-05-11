import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerDeleteTimeRangeProfileTool } from '../../src/tools/deleteTimeRangeProfile.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/deleteTimeRangeProfile', () => {
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
            deleteTimeRangeProfile: vi.fn(),
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

    describe('registerDeleteTimeRangeProfileTool', () => {
        it('registers the deleteTimeRangeProfile tool with correct schema', () => {
            registerDeleteTimeRangeProfileTool(mockServer, mockClient);
            expect(mockServer.registerTool).toHaveBeenCalledWith('deleteTimeRangeProfile', expect.any(Object), expect.any(Function));
        });

        it('deletes a profile by ID', async () => {
            const mockData = { success: true };
            (mockClient.deleteTimeRangeProfile as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerDeleteTimeRangeProfileTool(mockServer, mockClient);

            const result = await toolHandler({ profileId: 'tr-1' }, { sessionId: 'test-session' });

            expect(mockClient.deleteTimeRangeProfile).toHaveBeenCalledWith('tr-1', undefined, undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('passes siteId when provided', async () => {
            (mockClient.deleteTimeRangeProfile as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerDeleteTimeRangeProfileTool(mockServer, mockClient);
            await toolHandler({ profileId: 'tr-1', siteId: 'site-x' }, { sessionId: 'test-session' });
            expect(mockClient.deleteTimeRangeProfile).toHaveBeenCalledWith('tr-1', 'site-x', undefined);
        });

        it('passes customHeaders when provided', async () => {
            (mockClient.deleteTimeRangeProfile as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerDeleteTimeRangeProfileTool(mockServer, mockClient);
            await toolHandler({ profileId: 'tr-1', customHeaders: { 'X-H': 'v' } }, { sessionId: 'test-session' });
            expect(mockClient.deleteTimeRangeProfile).toHaveBeenCalledWith('tr-1', undefined, { 'X-H': 'v' });
        });

        it('handles errors from the client', async () => {
            (mockClient.deleteTimeRangeProfile as ReturnType<typeof vi.fn>).mockRejectedValue(
                new Error('Failed to delete this time range profile because it is applied in ACL.')
            );
            registerDeleteTimeRangeProfileTool(mockServer, mockClient);
            await expect(toolHandler({ profileId: 'tr-1' }, { sessionId: 'test-session' })).rejects.toThrow('applied in ACL.');
            expect(loggerModule.logger.error).toHaveBeenCalled();
        });
    });
});
