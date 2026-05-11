import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerModifyOsgAclTool } from '../../src/tools/modifyOsgAcl.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/modifyOsgAcl', () => {
    let mockServer: McpServer;
    let mockClient: OmadaClient;
    let toolHandler: (args: unknown, extra: { sessionId?: string }) => Promise<unknown>;

    const baseArgs = {
        aclId: 'osg-acl-1',
        description: 'Block IoT to LAN',
        status: true,
        policy: 0,
        protocols: [6, 17],
        sourceType: 0,
        sourceIds: ['net-iot'],
        destinationType: 0,
        direction: { lanToLan: true },
        stateMode: 0,
        syslog: false,
    };

    const expectedBody = {
        description: baseArgs.description,
        status: baseArgs.status,
        policy: baseArgs.policy,
        protocols: baseArgs.protocols,
        sourceType: baseArgs.sourceType,
        sourceIds: baseArgs.sourceIds,
        destinationType: baseArgs.destinationType,
        direction: baseArgs.direction,
        stateMode: baseArgs.stateMode,
        syslog: baseArgs.syslog,
    };

    beforeEach(() => {
        mockServer = {
            registerTool: vi.fn((_name, _schema, handler) => {
                toolHandler = handler;
            }),
        } as unknown as McpServer;

        mockClient = {
            modifyOsgAcl: vi.fn(),
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

    describe('registerModifyOsgAclTool', () => {
        it('registers the modifyOsgAcl tool with correct schema', () => {
            registerModifyOsgAclTool(mockServer, mockClient);
            expect(mockServer.registerTool).toHaveBeenCalledWith('modifyOsgAcl', expect.any(Object), expect.any(Function));
        });

        it('forwards aclId as path arg and the rest of args as body', async () => {
            const mockData = { id: 'osg-acl-1' };
            (mockClient.modifyOsgAcl as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerModifyOsgAclTool(mockServer, mockClient);

            const result = await toolHandler(baseArgs, { sessionId: 'test-session' });

            expect(mockClient.modifyOsgAcl).toHaveBeenCalledWith('osg-acl-1', expectedBody, undefined, undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('passes siteId when provided', async () => {
            (mockClient.modifyOsgAcl as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerModifyOsgAclTool(mockServer, mockClient);
            await toolHandler({ ...baseArgs, siteId: 'site-x' }, { sessionId: 'test-session' });
            expect(mockClient.modifyOsgAcl).toHaveBeenCalledWith('osg-acl-1', expectedBody, 'site-x', undefined);
        });

        it('passes customHeaders when provided', async () => {
            (mockClient.modifyOsgAcl as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerModifyOsgAclTool(mockServer, mockClient);
            await toolHandler({ ...baseArgs, customHeaders: { 'X-H': 'v' } }, { sessionId: 'test-session' });
            expect(mockClient.modifyOsgAcl).toHaveBeenCalledWith('osg-acl-1', expectedBody, undefined, { 'X-H': 'v' });
        });

        it('forwards optional fields (destinationIds, states, timeRangeId)', async () => {
            (mockClient.modifyOsgAcl as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerModifyOsgAclTool(mockServer, mockClient);
            await toolHandler(
                {
                    ...baseArgs,
                    destinationIds: ['net-lan'],
                    stateMode: 1,
                    states: { stateNew: true, established: true, related: false, invalid: false },
                    timeRangeId: 'time-range-1',
                },
                { sessionId: 'test-session' }
            );
            expect(mockClient.modifyOsgAcl).toHaveBeenCalledWith(
                'osg-acl-1',
                {
                    ...expectedBody,
                    destinationIds: ['net-lan'],
                    stateMode: 1,
                    states: { stateNew: true, established: true, related: false, invalid: false },
                    timeRangeId: 'time-range-1',
                },
                undefined,
                undefined
            );
        });

        it('handles errors from the client', async () => {
            (mockClient.modifyOsgAcl as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Invalid request parameters.'));
            registerModifyOsgAclTool(mockServer, mockClient);
            await expect(toolHandler(baseArgs, { sessionId: 'test-session' })).rejects.toThrow('Invalid request parameters.');
            expect(loggerModule.logger.error).toHaveBeenCalled();
        });
    });
});
