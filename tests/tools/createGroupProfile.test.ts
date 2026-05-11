import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerCreateGroupProfileTool } from '../../src/tools/createGroupProfile.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/createGroupProfile', () => {
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
            createGroupProfile: vi.fn(),
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

    describe('registerCreateGroupProfileTool', () => {
        it('registers the createGroupProfile tool with correct schema', () => {
            registerCreateGroupProfileTool(mockServer, mockClient);
            expect(mockServer.registerTool).toHaveBeenCalledWith('createGroupProfile', expect.any(Object), expect.any(Function));
        });

        it('creates an IP group successfully', async () => {
            const mockData = { id: 'group-123', name: 'IPG_TEST', type: 0 };
            (mockClient.createGroupProfile as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerCreateGroupProfileTool(mockServer, mockClient);

            const result = await toolHandler({ name: 'IPG_TEST', type: 0, ipList: [{ ip: '10.0.0.0', mask: 8 }] }, { sessionId: 'test-session' });

            expect(mockClient.createGroupProfile).toHaveBeenCalledWith(
                { name: 'IPG_TEST', type: 0, ipList: [{ ip: '10.0.0.0', mask: 8 }] },
                undefined,
                undefined
            );
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('passes siteId when provided', async () => {
            const mockData = { id: 'g' };
            (mockClient.createGroupProfile as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerCreateGroupProfileTool(mockServer, mockClient);

            await toolHandler({ name: 'g', type: 0, ipList: [{ ip: '1.1.1.1', mask: 32 }], siteId: 'test-site' }, { sessionId: 'test-session' });

            expect(mockClient.createGroupProfile).toHaveBeenCalledWith(
                { name: 'g', type: 0, ipList: [{ ip: '1.1.1.1', mask: 32 }] },
                'test-site',
                undefined
            );
        });

        it('passes customHeaders when provided', async () => {
            const mockData = { id: 'g' };
            (mockClient.createGroupProfile as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerCreateGroupProfileTool(mockServer, mockClient);

            await toolHandler({ name: 'g', type: 0, customHeaders: { 'X-Header': 'v' } }, { sessionId: 'test-session' });

            expect(mockClient.createGroupProfile).toHaveBeenCalledWith({ name: 'g', type: 0 }, undefined, { 'X-Header': 'v' });
        });

        it('handles errors from the client', async () => {
            const error = new Error('API error');
            (mockClient.createGroupProfile as ReturnType<typeof vi.fn>).mockRejectedValue(error);

            registerCreateGroupProfileTool(mockServer, mockClient);

            await expect(toolHandler({ name: 'g', type: 0 }, { sessionId: 'test-session' })).rejects.toThrow('API error');

            expect(loggerModule.logger.error).toHaveBeenCalled();
        });

        it('rejects invalid group type via schema refine validator', async () => {
            const { z } = await import('zod');
            registerCreateGroupProfileTool(mockServer, mockClient);
            const registerCall = (mockServer.registerTool as ReturnType<typeof vi.fn>).mock.calls[0];
            const schemaShape = registerCall[1].inputSchema as Record<string, z.ZodTypeAny>;
            const fullSchema = z.object(schemaShape);

            // type=99 is not in the allowed set [0,1,2,3,4,5,7] — refine() rejects
            const invalidResult = fullSchema.safeParse({ name: 'g', type: 99 });
            expect(invalidResult.success).toBe(false);
            if (!invalidResult.success) {
                expect(invalidResult.error.issues[0].message).toContain('type must be one of');
            }

            // type=0 is valid — accepted
            const validResult = fullSchema.safeParse({ name: 'g', type: 0 });
            expect(validResult.success).toBe(true);

            // type=7 (Domain) is also valid (gap in the sequence — Omada doesn't use 6)
            const domainResult = fullSchema.safeParse({ name: 'g', type: 7 });
            expect(domainResult.success).toBe(true);
        });

        it('accepts MAC group with macAddressList', async () => {
            (mockClient.createGroupProfile as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'm' });

            registerCreateGroupProfileTool(mockServer, mockClient);

            await toolHandler(
                {
                    name: 'MAC_GROUP',
                    type: 2,
                    macAddressList: [{ mac: 'AA:BB:CC:DD:EE:FF', description: 'test device' }],
                },
                { sessionId: 'test-session' }
            );

            expect(mockClient.createGroupProfile).toHaveBeenCalledWith(
                {
                    name: 'MAC_GROUP',
                    type: 2,
                    macAddressList: [{ mac: 'AA:BB:CC:DD:EE:FF', description: 'test device' }],
                },
                undefined,
                undefined
            );
        });
    });
});
