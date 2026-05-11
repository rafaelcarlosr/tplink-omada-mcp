import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerModifyEapAclTool } from '../../src/tools/modifyEapAcl.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/modifyEapAcl', () => {
    let mockServer: McpServer;
    let mockClient: OmadaClient;
    let toolHandler: (args: unknown, extra: { sessionId?: string }) => Promise<unknown>;

    const baseArgs = {
        aclId: 'eap-acl-1',
        description: 'Block IoT SSID->LAN',
        status: true,
        policy: 0,
        protocols: [6, 17],
        sourceType: 4,
        sourceIds: ['ssid-iot'],
        destinationType: 0,
    };

    const expectedBody = {
        description: baseArgs.description,
        status: baseArgs.status,
        policy: baseArgs.policy,
        protocols: baseArgs.protocols,
        sourceType: baseArgs.sourceType,
        sourceIds: baseArgs.sourceIds,
        destinationType: baseArgs.destinationType,
    };

    beforeEach(() => {
        mockServer = {
            registerTool: vi.fn((_name, _schema, handler) => {
                toolHandler = handler;
            }),
        } as unknown as McpServer;

        mockClient = {
            modifyEapAcl: vi.fn(),
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

    describe('registerModifyEapAclTool', () => {
        it('registers the modifyEapAcl tool with correct schema', () => {
            registerModifyEapAclTool(mockServer, mockClient);
            expect(mockServer.registerTool).toHaveBeenCalledWith('modifyEapAcl', expect.any(Object), expect.any(Function));
        });

        it('forwards aclId as path arg and the rest of args as body', async () => {
            const mockData = { id: 'eap-acl-1' };
            (mockClient.modifyEapAcl as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerModifyEapAclTool(mockServer, mockClient);

            const result = await toolHandler(baseArgs, { sessionId: 'test-session' });

            expect(mockClient.modifyEapAcl).toHaveBeenCalledWith('eap-acl-1', expectedBody, undefined, undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('passes siteId when provided', async () => {
            (mockClient.modifyEapAcl as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerModifyEapAclTool(mockServer, mockClient);
            await toolHandler({ ...baseArgs, siteId: 'site-x' }, { sessionId: 'test-session' });
            expect(mockClient.modifyEapAcl).toHaveBeenCalledWith('eap-acl-1', expectedBody, 'site-x', undefined);
        });

        it('passes customHeaders when provided', async () => {
            (mockClient.modifyEapAcl as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerModifyEapAclTool(mockServer, mockClient);
            await toolHandler({ ...baseArgs, customHeaders: { 'X-H': 'v' } }, { sessionId: 'test-session' });
            expect(mockClient.modifyEapAcl).toHaveBeenCalledWith('eap-acl-1', expectedBody, undefined, { 'X-H': 'v' });
        });

        it('forwards destinationIds when provided', async () => {
            (mockClient.modifyEapAcl as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerModifyEapAclTool(mockServer, mockClient);
            await toolHandler({ ...baseArgs, destinationIds: ['net-lan'] }, { sessionId: 'test-session' });
            expect(mockClient.modifyEapAcl).toHaveBeenCalledWith('eap-acl-1', { ...expectedBody, destinationIds: ['net-lan'] }, undefined, undefined);
        });

        it('handles errors from the client', async () => {
            (mockClient.modifyEapAcl as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Invalid request parameters.'));
            registerModifyEapAclTool(mockServer, mockClient);
            await expect(toolHandler(baseArgs, { sessionId: 'test-session' })).rejects.toThrow('Invalid request parameters.');
            expect(loggerModule.logger.error).toHaveBeenCalled();
        });
    });
});
