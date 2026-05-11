import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { OmadaClient } from '../omadaClient/index.js';
import { siteInputSchema, toToolResult, wrapToolHandler } from '../server/common.js';

const ipSubnetSchema = z.object({
    ip: z.string().min(1),
    mask: z.number().int().min(0).max(32),
});

const ipv6SubnetSchema = z.object({
    ip: z.string().min(1),
    prefix: z.number().int().min(0).max(128),
});

const portMaskSchema = z.object({
    port: z.number().int().min(0).max(65535),
    mask: z.string().min(1),
});

const macAddressSchema = z.object({
    mac: z.string().min(1),
    description: z.string().optional(),
});

const domainPortSchema = z.object({
    address: z.string().min(1),
    port: z.number().int().min(0).max(65535).optional(),
});

export function registerUpdateGroupProfileTool(server: McpServer, client: OmadaClient): void {
    const inputSchema = siteInputSchema.extend({
        groupType: z
            .string()
            .min(1, 'groupType is required (string form: "0"=IP, "1"=IP-Port, "2"=MAC, "3"=IPv6, "4"=IPv6-Port, "5"=Country, "7"=Domain)'),
        groupId: z.string().min(1, 'groupId is required (returned from listGroupProfiles or createGroupProfile)'),
        name: z.string().min(1).max(64),
        type: z.number().int().describe('Must match groupType (numeric form)'),
        ipList: z.array(ipSubnetSchema).optional(),
        ipv6List: z.array(ipv6SubnetSchema).optional(),
        portType: z.number().int().min(0).max(1).optional(),
        portList: z.array(z.string()).optional(),
        portMaskList: z.array(portMaskSchema).optional(),
        macAddressList: z.array(macAddressSchema).optional(),
        countryList: z.array(z.string()).optional(),
        description: z.string().max(256).optional(),
        domainNamePort: z.array(domainPortSchema).optional(),
    });

    server.registerTool(
        'updateGroupProfile',
        {
            description:
                'Modify an existing group profile. Replaces the entire group definition (full PUT-like semantics on PATCH endpoint). To add/remove members from an IP group, fetch with getGroupProfilesByType, modify the ipList, then call this. Required fields depend on the group type.',
            inputSchema: inputSchema.shape,
        },
        wrapToolHandler('updateGroupProfile', async (args) => {
            const { siteId, customHeaders, groupType, groupId, ...groupData } = args;
            return toToolResult(await client.updateGroupProfile(groupType, groupId, groupData, siteId, customHeaders));
        })
    );
}
