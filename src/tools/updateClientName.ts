import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { OmadaClient } from '../omadaClient/index.js';
import { siteInputSchema, toToolResult, wrapToolHandler } from '../server/common.js';

export function registerUpdateClientNameTool(server: McpServer, client: OmadaClient): void {
    const inputSchema = siteInputSchema.extend({
        clientMac: z.string().min(1, 'clientMac is required (format: AA-BB-CC-11-22-33)'),
        name: z
            .string()
            .min(1, 'name must be 1-128 characters')
            .max(128, 'name must be 1-128 characters')
            .describe('New display name for the client (1-128 chars, no leading/trailing spaces or `+ - @ =`).'),
    });

    server.registerTool(
        'updateClientName',
        {
            description:
                'Rename a client (set display name) by MAC address. PATCH /sites/{siteId}/clients/{clientMac}/name. Replaces the failed `updateClient` 405 path documented in PROJECT.md §1 — `updateClient` requires the UI; this dedicated name endpoint is the supported Open API alternative for renaming clients.',
            inputSchema: inputSchema.shape,
        },
        wrapToolHandler('updateClientName', async ({ clientMac, name, siteId, customHeaders }) =>
            toToolResult(await client.updateClientName(clientMac, { name }, siteId, customHeaders))
        )
    );
}
