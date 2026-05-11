import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { OmadaClient } from '../omadaClient/index.js';
import { siteInputSchema, toToolResult, wrapToolHandler } from '../server/common.js';

const dhcpOptionSchema = z.object({
    code: z.number().int().describe('Custom DHCP option code'),
    type: z.number().int().describe('0=String, 1=IP Address, 2=Hex Array'),
    value: z.string(),
});

export function registerUpdateDhcpReservationTool(server: McpServer, client: OmadaClient): void {
    const inputSchema = siteInputSchema.extend({
        mac: z.string().min(1, 'mac is required (format: AA-BB-CC-11-22-33)'),
        netId: z.string().min(1, 'netId is required (LAN network ID from getLanNetworkList)'),
        status: z.boolean().describe('Reservation enabled status'),
        ip: z.string().optional().describe('Reserved IPv4 address'),
        description: z.string().max(128).optional().describe('1-128 characters, no leading/trailing spaces'),
        options: z.array(dhcpOptionSchema).optional().describe('Advanced custom DHCP options'),
        confirmConflict: z.boolean().optional().describe('Set true to override IP/IP-MAC conflict errors'),
    });

    server.registerTool(
        'updateDhcpReservation',
        {
            description:
                'Modify an existing DHCP reservation by MAC address. Replaces the reservation body (full PATCH semantics on the resource). Required: mac (path), netId, status. Used to rename, re-IP, or toggle a reservation without recreating it. Replaces the failed `updateClient` 405 path for DHCP labels.',
            inputSchema: inputSchema.shape,
        },
        wrapToolHandler('updateDhcpReservation', async (args) => {
            const { siteId, customHeaders, mac, ...body } = args;
            return toToolResult(await client.updateDhcpReservation(mac, body, siteId, customHeaders));
        })
    );
}
