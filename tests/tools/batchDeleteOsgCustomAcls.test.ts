import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerBatchDeleteOsgCustomAclsTool } from '../../src/tools/batchDeleteOsgCustomAcls.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/batchDeleteOsgCustomAcls', () => {
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
            batchDeleteOsgCustomAcls: vi.fn(),
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

    describe('registerBatchDeleteOsgCustomAclsTool', () => {
        it('registers the batchDeleteOsgCustomAcls tool with correct schema', () => {
            registerBatchDeleteOsgCustomAclsTool(mockServer, mockClient);
            expect(mockServer.registerTool).toHaveBeenCalledWith('batchDeleteOsgCustomAcls', expect.any(Object), expect.any(Function));
        });

        it('forwards selectType=include with ids as body', async () => {
            const mockData = { success: true };
            (mockClient.batchDeleteOsgCustomAcls as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerBatchDeleteOsgCustomAclsTool(mockServer, mockClient);

            const result = await toolHandler({ selectType: 'include', ids: ['acl-1', 'acl-2'] }, { sessionId: 'test-session' });

            expect(mockClient.batchDeleteOsgCustomAcls).toHaveBeenCalledWith(
                { selectType: 'include', ids: ['acl-1', 'acl-2'] },
                undefined,
                undefined
            );
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('forwards selectType=all without ids', async () => {
            (mockClient.batchDeleteOsgCustomAcls as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerBatchDeleteOsgCustomAclsTool(mockServer, mockClient);
            await toolHandler({ selectType: 'all' }, { sessionId: 'test-session' });
            expect(mockClient.batchDeleteOsgCustomAcls).toHaveBeenCalledWith({ selectType: 'all' }, undefined, undefined);
        });

        it('forwards selectType=exclude with ids and searchKey', async () => {
            (mockClient.batchDeleteOsgCustomAcls as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerBatchDeleteOsgCustomAclsTool(mockServer, mockClient);
            await toolHandler({ selectType: 'exclude', ids: ['acl-keep'], searchKey: 'old-' }, { sessionId: 'test-session' });
            expect(mockClient.batchDeleteOsgCustomAcls).toHaveBeenCalledWith(
                { selectType: 'exclude', ids: ['acl-keep'], searchKey: 'old-' },
                undefined,
                undefined
            );
        });

        it('passes siteId when provided', async () => {
            (mockClient.batchDeleteOsgCustomAcls as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerBatchDeleteOsgCustomAclsTool(mockServer, mockClient);
            await toolHandler({ selectType: 'all', siteId: 'site-x' }, { sessionId: 'test-session' });
            expect(mockClient.batchDeleteOsgCustomAcls).toHaveBeenCalledWith({ selectType: 'all' }, 'site-x', undefined);
        });

        it('passes customHeaders when provided', async () => {
            (mockClient.batchDeleteOsgCustomAcls as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerBatchDeleteOsgCustomAclsTool(mockServer, mockClient);
            await toolHandler({ selectType: 'all', customHeaders: { 'X-H': 'v' } }, { sessionId: 'test-session' });
            expect(mockClient.batchDeleteOsgCustomAcls).toHaveBeenCalledWith({ selectType: 'all' }, undefined, { 'X-H': 'v' });
        });

        it('handles errors from the client', async () => {
            (mockClient.batchDeleteOsgCustomAcls as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Invalid request parameters.'));
            registerBatchDeleteOsgCustomAclsTool(mockServer, mockClient);
            await expect(toolHandler({ selectType: 'all' }, { sessionId: 'test-session' })).rejects.toThrow('Invalid request parameters.');
            expect(loggerModule.logger.error).toHaveBeenCalled();
        });
    });
});
