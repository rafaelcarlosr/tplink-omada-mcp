import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerDeleteAclTool } from '../../src/tools/deleteAcl.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/deleteAcl', () => {
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
            deleteAcl: vi.fn(),
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

    describe('registerDeleteAclTool', () => {
        it('registers the deleteAcl tool with correct schema', () => {
            registerDeleteAclTool(mockServer, mockClient);
            expect(mockServer.registerTool).toHaveBeenCalledWith('deleteAcl', expect.any(Object), expect.any(Function));
        });

        it('deletes an ACL by ID', async () => {
            const mockData = { success: true };
            (mockClient.deleteAcl as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerDeleteAclTool(mockServer, mockClient);

            const result = await toolHandler({ aclId: 'acl-xyz' }, { sessionId: 'test-session' });

            expect(mockClient.deleteAcl).toHaveBeenCalledWith('acl-xyz', undefined, undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('passes siteId when provided', async () => {
            (mockClient.deleteAcl as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerDeleteAclTool(mockServer, mockClient);
            await toolHandler({ aclId: 'acl-xyz', siteId: 'site-x' }, { sessionId: 'test-session' });
            expect(mockClient.deleteAcl).toHaveBeenCalledWith('acl-xyz', 'site-x', undefined);
        });

        it('passes customHeaders when provided', async () => {
            (mockClient.deleteAcl as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerDeleteAclTool(mockServer, mockClient);
            await toolHandler({ aclId: 'acl-xyz', customHeaders: { 'X-H': 'v' } }, { sessionId: 'test-session' });
            expect(mockClient.deleteAcl).toHaveBeenCalledWith('acl-xyz', undefined, { 'X-H': 'v' });
        });

        it('handles errors from the client', async () => {
            (mockClient.deleteAcl as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ACL not found'));
            registerDeleteAclTool(mockServer, mockClient);
            await expect(toolHandler({ aclId: 'acl-xyz' }, { sessionId: 'test-session' })).rejects.toThrow('ACL not found');
            expect(loggerModule.logger.error).toHaveBeenCalled();
        });
    });
});
