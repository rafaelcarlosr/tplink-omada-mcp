import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerUpdateDhcpReservationTool } from '../../src/tools/updateDhcpReservation.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/updateDhcpReservation', () => {
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
            updateDhcpReservation: vi.fn(),
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

    describe('registerUpdateDhcpReservationTool', () => {
        it('registers the updateDhcpReservation tool with correct schema', () => {
            registerUpdateDhcpReservationTool(mockServer, mockClient);
            expect(mockServer.registerTool).toHaveBeenCalledWith('updateDhcpReservation', expect.any(Object), expect.any(Function));
        });

        it('updates a reservation with the mac in the path and the rest of args as body', async () => {
            const mockData = { id: 'res-1' };
            (mockClient.updateDhcpReservation as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerUpdateDhcpReservationTool(mockServer, mockClient);

            const result = await toolHandler(
                { mac: 'AA-BB-CC-11-22-33', netId: 'net-1', status: true, ip: '192.168.1.50', description: 'NAS' },
                { sessionId: 'test-session' }
            );

            expect(mockClient.updateDhcpReservation).toHaveBeenCalledWith(
                'AA-BB-CC-11-22-33',
                { netId: 'net-1', status: true, ip: '192.168.1.50', description: 'NAS' },
                undefined,
                undefined
            );
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('passes siteId when provided', async () => {
            (mockClient.updateDhcpReservation as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerUpdateDhcpReservationTool(mockServer, mockClient);
            await toolHandler({ mac: 'AA-BB-CC-11-22-33', netId: 'net-1', status: true, siteId: 'site-x' }, { sessionId: 'test-session' });
            expect(mockClient.updateDhcpReservation).toHaveBeenCalledWith('AA-BB-CC-11-22-33', { netId: 'net-1', status: true }, 'site-x', undefined);
        });

        it('passes customHeaders when provided', async () => {
            (mockClient.updateDhcpReservation as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerUpdateDhcpReservationTool(mockServer, mockClient);
            await toolHandler(
                { mac: 'AA-BB-CC-11-22-33', netId: 'net-1', status: true, customHeaders: { 'X-H': 'v' } },
                { sessionId: 'test-session' }
            );
            expect(mockClient.updateDhcpReservation).toHaveBeenCalledWith('AA-BB-CC-11-22-33', { netId: 'net-1', status: true }, undefined, {
                'X-H': 'v',
            });
        });

        it('forwards optional fields (options, confirmConflict) in the body', async () => {
            (mockClient.updateDhcpReservation as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerUpdateDhcpReservationTool(mockServer, mockClient);
            await toolHandler(
                {
                    mac: 'AA-BB-CC-11-22-33',
                    netId: 'net-1',
                    status: false,
                    options: [{ code: 43, type: 0, value: 'hello' }],
                    confirmConflict: true,
                },
                { sessionId: 'test-session' }
            );
            expect(mockClient.updateDhcpReservation).toHaveBeenCalledWith(
                'AA-BB-CC-11-22-33',
                {
                    netId: 'net-1',
                    status: false,
                    options: [{ code: 43, type: 0, value: 'hello' }],
                    confirmConflict: true,
                },
                undefined,
                undefined
            );
        });

        it('handles errors from the client', async () => {
            (mockClient.updateDhcpReservation as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('IP conflicts with existing reservation'));
            registerUpdateDhcpReservationTool(mockServer, mockClient);
            await expect(toolHandler({ mac: 'AA-BB-CC-11-22-33', netId: 'net-1', status: true }, { sessionId: 'test-session' })).rejects.toThrow(
                'IP conflicts with existing reservation'
            );
            expect(loggerModule.logger.error).toHaveBeenCalled();
        });
    });
});
