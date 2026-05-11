import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { OmadaClient } from '../omadaClient/index.js';
import { siteInputSchema, toToolResult, wrapToolHandler } from '../server/common.js';

export function registerDeleteLanNetworkTool(server: McpServer, client: OmadaClient): void {
    const inputSchema = siteInputSchema.extend({
        networkId: z.string().min(1, 'networkId is required (see getLanNetworkList / getLanNetworkListV2)'),
    });

    server.registerTool(
        'deleteLanNetwork',
        {
            description:
                "Delete a LAN network by network ID. The Default LAN cannot be deleted. Deletion will also fail if the network is configured as a switch's native network or referenced by an IDS/IPS Allow List. Use getLanNetworkListV2 to discover existing networks.",
            inputSchema: inputSchema.shape,
        },
        wrapToolHandler('deleteLanNetwork', async ({ networkId, siteId, customHeaders }) =>
            toToolResult(await client.deleteLanNetwork(networkId, siteId, customHeaders))
        )
    );
}
