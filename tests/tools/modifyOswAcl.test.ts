import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerModifyOswAclTool } from '../../src/tools/modifyOswAcl.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/modifyOswAcl', () => {
    let mockServer: McpServer;
    let mockClient: OmadaClient;
    let toolHandler: (args: unknown, extra: { sessionId?: string }) => Promise<unknown>;

    const baseArgs = {
        aclId: 'osw-acl-1',
        description: 'Block VLAN10 to VLAN20',
        status: true,
        policy: 0,
        protocols: [6],
        sourceType: 0,
        sourceIds: ['net-vlan10'],
        destinationType: 0,
        bindingType: 0,
        etherType: { enable: false },
    };

    const expectedBody = {
        description: baseArgs.description,
        status: baseArgs.status,
        policy: baseArgs.policy,
        protocols: baseArgs.protocols,
        sourceType: baseArgs.sourceType,
        sourceIds: baseArgs.sourceIds,
        destinationType: baseArgs.destinationType,
        bindingType: baseArgs.bindingType,
        etherType: baseArgs.etherType,
    };

    beforeEach(() => {
        mockServer = {
            registerTool: vi.fn((_name, _schema, handler) => {
                toolHandler = handler;
            }),
        } as unknown as McpServer;

        mockClient = {
            modifyOswAcl: vi.fn(),
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

    describe('registerModifyOswAclTool', () => {
        it('registers the modifyOswAcl tool with correct schema', () => {
            registerModifyOswAclTool(mockServer, mockClient);
            expect(mockServer.registerTool).toHaveBeenCalledWith('modifyOswAcl', expect.any(Object), expect.any(Function));
        });

        it('forwards aclId as path arg and the rest of args as body', async () => {
            const mockData = { id: 'osw-acl-1' };
            (mockClient.modifyOswAcl as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerModifyOswAclTool(mockServer, mockClient);

            const result = await toolHandler(baseArgs, { sessionId: 'test-session' });

            expect(mockClient.modifyOswAcl).toHaveBeenCalledWith('osw-acl-1', expectedBody, undefined, undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('passes siteId when provided', async () => {
            (mockClient.modifyOswAcl as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerModifyOswAclTool(mockServer, mockClient);
            await toolHandler({ ...baseArgs, siteId: 'site-x' }, { sessionId: 'test-session' });
            expect(mockClient.modifyOswAcl).toHaveBeenCalledWith('osw-acl-1', expectedBody, 'site-x', undefined);
        });

        it('passes customHeaders when provided', async () => {
            (mockClient.modifyOswAcl as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerModifyOswAclTool(mockServer, mockClient);
            await toolHandler({ ...baseArgs, customHeaders: { 'X-H': 'v' } }, { sessionId: 'test-session' });
            expect(mockClient.modifyOswAcl).toHaveBeenCalledWith('osw-acl-1', expectedBody, undefined, { 'X-H': 'v' });
        });

        it('forwards binding-related fields for VLAN binding', async () => {
            (mockClient.modifyOswAcl as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerModifyOswAclTool(mockServer, mockClient);
            await toolHandler(
                {
                    ...baseArgs,
                    bindingType: 2,
                    networkId: 'net-trunk',
                    bindingBridgeVlan: 10,
                    destinationIds: ['net-vlan20'],
                    timeRangeId: 'time-1',
                    biDirectional: true,
                },
                { sessionId: 'test-session' }
            );
            expect(mockClient.modifyOswAcl).toHaveBeenCalledWith(
                'osw-acl-1',
                {
                    ...expectedBody,
                    bindingType: 2,
                    networkId: 'net-trunk',
                    bindingBridgeVlan: 10,
                    destinationIds: ['net-vlan20'],
                    timeRangeId: 'time-1',
                    biDirectional: true,
                },
                undefined,
                undefined
            );
        });

        it('forwards customAclPorts when bindingType=1', async () => {
            (mockClient.modifyOswAcl as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerModifyOswAclTool(mockServer, mockClient);
            await toolHandler(
                {
                    ...baseArgs,
                    bindingType: 1,
                    customAclPorts: [{ mac: 'AA-BB-CC-11-22-33', customPortIds: [1, 2], customLagIds: [] }],
                },
                { sessionId: 'test-session' }
            );
            expect(mockClient.modifyOswAcl).toHaveBeenCalledWith(
                'osw-acl-1',
                {
                    ...expectedBody,
                    bindingType: 1,
                    customAclPorts: [{ mac: 'AA-BB-CC-11-22-33', customPortIds: [1, 2], customLagIds: [] }],
                },
                undefined,
                undefined
            );
        });

        it('handles errors from the client', async () => {
            (mockClient.modifyOswAcl as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Invalid request parameters.'));
            registerModifyOswAclTool(mockServer, mockClient);
            await expect(toolHandler(baseArgs, { sessionId: 'test-session' })).rejects.toThrow('Invalid request parameters.');
            expect(loggerModule.logger.error).toHaveBeenCalled();
        });
    });
});
