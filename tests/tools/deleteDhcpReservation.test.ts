import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerDeleteDhcpReservationTool } from '../../src/tools/deleteDhcpReservation.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/deleteDhcpReservation', () => {
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
            deleteDhcpReservation: vi.fn(),
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

    describe('registerDeleteDhcpReservationTool', () => {
        it('registers the deleteDhcpReservation tool with correct schema', () => {
            registerDeleteDhcpReservationTool(mockServer, mockClient);
            expect(mockServer.registerTool).toHaveBeenCalledWith('deleteDhcpReservation', expect.any(Object), expect.any(Function));
        });

        it('deletes a reservation with required mac', async () => {
            const mockData = { success: true };
            (mockClient.deleteDhcpReservation as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerDeleteDhcpReservationTool(mockServer, mockClient);

            const result = await toolHandler({ mac: 'AA-BB-CC-11-22-33' }, { sessionId: 'test-session' });

            expect(mockClient.deleteDhcpReservation).toHaveBeenCalledWith('AA-BB-CC-11-22-33', undefined, undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('passes siteId when provided', async () => {
            (mockClient.deleteDhcpReservation as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerDeleteDhcpReservationTool(mockServer, mockClient);
            await toolHandler({ mac: 'AA-BB-CC-11-22-33', siteId: 'site-x' }, { sessionId: 'test-session' });
            expect(mockClient.deleteDhcpReservation).toHaveBeenCalledWith('AA-BB-CC-11-22-33', 'site-x', undefined);
        });

        it('passes customHeaders when provided', async () => {
            (mockClient.deleteDhcpReservation as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerDeleteDhcpReservationTool(mockServer, mockClient);
            await toolHandler({ mac: 'AA-BB-CC-11-22-33', customHeaders: { 'X-H': 'v' } }, { sessionId: 'test-session' });
            expect(mockClient.deleteDhcpReservation).toHaveBeenCalledWith('AA-BB-CC-11-22-33', undefined, { 'X-H': 'v' });
        });

        it('handles errors from the client', async () => {
            (mockClient.deleteDhcpReservation as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Reservation not found'));
            registerDeleteDhcpReservationTool(mockServer, mockClient);
            await expect(toolHandler({ mac: 'AA-BB-CC-11-22-33' }, { sessionId: 'test-session' })).rejects.toThrow('Reservation not found');
            expect(loggerModule.logger.error).toHaveBeenCalled();
        });
    });
});
