import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerModifyAclIndexTool } from '../../src/tools/modifyAclIndex.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/modifyAclIndex', () => {
    let mockServer: McpServer;
    let mockClient: OmadaClient;
    let toolHandler: (args: unknown, extra: { sessionId?: string }) => Promise<unknown>;

    const baseArgs = {
        type: 'gateway' as const,
        indexes: { 'acl-a': 0, 'acl-b': 1, 'acl-c': 2 },
    };

    const expectedBody = {
        type: baseArgs.type,
        indexes: baseArgs.indexes,
    };

    beforeEach(() => {
        mockServer = {
            registerTool: vi.fn((_name, _schema, handler) => {
                toolHandler = handler;
            }),
        } as unknown as McpServer;

        mockClient = {
            modifyAclIndex: vi.fn(),
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

    describe('registerModifyAclIndexTool', () => {
        it('registers the modifyAclIndex tool with correct schema', () => {
            registerModifyAclIndexTool(mockServer, mockClient);
            expect(mockServer.registerTool).toHaveBeenCalledWith('modifyAclIndex', expect.any(Object), expect.any(Function));
        });

        it('forwards type + indexes as body for gateway ACLs', async () => {
            const mockData = { success: true };
            (mockClient.modifyAclIndex as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerModifyAclIndexTool(mockServer, mockClient);

            const result = await toolHandler(baseArgs, { sessionId: 'test-session' });

            expect(mockClient.modifyAclIndex).toHaveBeenCalledWith(expectedBody, undefined, undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('supports type=switch', async () => {
            (mockClient.modifyAclIndex as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerModifyAclIndexTool(mockServer, mockClient);
            await toolHandler({ type: 'switch', indexes: { 'osw-1': 0 } }, { sessionId: 'test-session' });
            expect(mockClient.modifyAclIndex).toHaveBeenCalledWith({ type: 'switch', indexes: { 'osw-1': 0 } }, undefined, undefined);
        });

        it('supports type=eap', async () => {
            (mockClient.modifyAclIndex as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerModifyAclIndexTool(mockServer, mockClient);
            await toolHandler({ type: 'eap', indexes: { 'eap-1': 0 } }, { sessionId: 'test-session' });
            expect(mockClient.modifyAclIndex).toHaveBeenCalledWith({ type: 'eap', indexes: { 'eap-1': 0 } }, undefined, undefined);
        });

        it('passes siteId when provided', async () => {
            (mockClient.modifyAclIndex as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerModifyAclIndexTool(mockServer, mockClient);
            await toolHandler({ ...baseArgs, siteId: 'site-x' }, { sessionId: 'test-session' });
            expect(mockClient.modifyAclIndex).toHaveBeenCalledWith(expectedBody, 'site-x', undefined);
        });

        it('passes customHeaders when provided', async () => {
            (mockClient.modifyAclIndex as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerModifyAclIndexTool(mockServer, mockClient);
            await toolHandler({ ...baseArgs, customHeaders: { 'X-H': 'v' } }, { sessionId: 'test-session' });
            expect(mockClient.modifyAclIndex).toHaveBeenCalledWith(expectedBody, undefined, { 'X-H': 'v' });
        });

        it('handles errors from the client', async () => {
            (mockClient.modifyAclIndex as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Invalid request parameters.'));
            registerModifyAclIndexTool(mockServer, mockClient);
            await expect(toolHandler(baseArgs, { sessionId: 'test-session' })).rejects.toThrow('Invalid request parameters.');
            expect(loggerModule.logger.error).toHaveBeenCalled();
        });
    });
});
