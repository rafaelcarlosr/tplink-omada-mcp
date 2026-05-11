import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { OmadaClient } from '../omadaClient/index.js';
import { siteInputSchema, toToolResult, wrapToolHandler } from '../server/common.js';

/**
 * Group profile types used by the Omada Open API.
 * 0: IP Group (uses ipList)
 * 1: IP Port Group (uses ipList + portType + portList/portMaskList)
 * 2: MAC Group (uses macAddressList)
 * 3: IPv6 Group (uses ipv6List)
 * 4: IPv6 Port Group (uses ipv6List + portType + portList/portMaskList)
 * 5: Country Group (uses countryList + description)
 * 7: Domain Group (uses domainNamePort)
 */
const GROUP_TYPE_VALUES = [0, 1, 2, 3, 4, 5, 7] as const;

const ipSubnetSchema = z.object({
    ip: z.string().min(1, 'ip is required'),
    mask: z.number().int().min(0).max(32),
});

const ipv6SubnetSchema = z.object({
    ip: z.string().min(1, 'ipv6 address is required'),
    prefix: z.number().int().min(0).max(128),
});

const portMaskSchema = z.object({
    port: z.number().int().min(0).max(65535),
    mask: z.string().min(1, 'port mask is required'),
});

const macAddressSchema = z.object({
    mac: z.string().min(1, 'mac is required'),
    description: z.string().optional(),
});

const domainPortSchema = z.object({
    address: z.string().min(1, 'domain address is required'),
    port: z.number().int().min(0).max(65535).optional(),
});

export function registerCreateGroupProfileTool(server: McpServer, client: OmadaClient): void {
    const inputSchema = siteInputSchema.extend({
        name: z.string().min(1, 'name is required (1-64 chars, no leading/trailing spaces)').max(64, 'name must be 1-64 chars'),
        type: z
            .number()
            .int()
            .refine((v) => (GROUP_TYPE_VALUES as readonly number[]).includes(v), {
                message: 'type must be one of: 0=IP, 1=IP-Port, 2=MAC, 3=IPv6, 4=IPv6-Port, 5=Country, 7=Domain',
            }),
        ipList: z.array(ipSubnetSchema).optional().describe('Required for type=0 or type=1 (IP / IP-Port groups)'),
        ipv6List: z.array(ipv6SubnetSchema).optional().describe('Required for type=3 or type=4 (IPv6 / IPv6-Port groups)'),
        portType: z.number().int().min(0).max(1).optional().describe('Required for type=1 or type=4. 0=port range, 1=port mask'),
        portList: z.array(z.string()).optional().describe('Required when portType=0. e.g. ["80", "8080-8090"]'),
        portMaskList: z.array(portMaskSchema).optional().describe('Required when portType=1'),
        macAddressList: z.array(macAddressSchema).optional().describe('Required for type=2 (MAC group)'),
        countryList: z.array(z.string()).optional().describe('Required for type=5 (Country group)'),
        description: z.string().max(256).optional().describe('Required for type=5 (Country); optional otherwise'),
        domainNamePort: z.array(domainPortSchema).optional().describe('Required for type=7 (Domain group)'),
    });

    server.registerTool(
        'createGroupProfile',
        {
            description:
                'Create a new group profile (IP, IP-Port, MAC, IPv6, IPv6-Port, Country, or Domain). Group profiles are reusable address sets referenced by ACL rules and other policies. Required fields depend on the group type — see field descriptions for the per-type requirements.',
            inputSchema: inputSchema.shape,
        },
        wrapToolHandler('createGroupProfile', async (args) => {
            const { siteId, customHeaders, ...groupData } = args;
            return toToolResult(await client.createGroupProfile(groupData, siteId, customHeaders));
        })
    );
}
