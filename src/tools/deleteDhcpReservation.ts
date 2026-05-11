import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { OmadaClient } from '../omadaClient/index.js';
import { siteInputSchema, toToolResult, wrapToolHandler } from '../server/common.js';

export function registerDeleteDhcpReservationTool(server: McpServer, client: OmadaClient): void {
    const inputSchema = siteInputSchema.extend({
        mac: z.string().min(1, 'mac is required (format: AA-BB-CC-11-22-33)'),
    });

    server.registerTool(
        'deleteDhcpReservation',
        {
            description:
                'Delete an existing DHCP reservation by MAC address. Use getDhcpReservationGrid to discover existing reservations. Once deleted, the device will receive an unreserved lease on its next DHCP renew.',
            inputSchema: inputSchema.shape,
        },
        wrapToolHandler('deleteDhcpReservation', async ({ mac, siteId, customHeaders }) =>
            toToolResult(await client.deleteDhcpReservation(mac, siteId, customHeaders))
        )
    );
}
