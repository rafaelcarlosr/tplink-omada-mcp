import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerUpdateSsidBasicConfigTool } from '../../src/tools/updateSsidBasicConfig.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/updateSsidBasicConfig', () => {
    let mockServer: McpServer;
    let mockClient: OmadaClient;
    let toolHandler: (args: unknown, extra: { sessionId?: string }) => Promise<unknown>;

    const baseArgs = {
        wlanId: 'wlan-1',
        ssidId: 'ssid-1',
        name: 'HomeWifi',
        band: 7,
        broadcast: true,
        guestNetEnable: false,
        security: 3,
        mloEnable: false,
        pmfMode: 2,
        enable11r: false,
        vlanEnable: true,
        vlanId: 10,
        pskSetting: { wpaMode: 4, psk: 'placeholder' },
    };

    const expectedBody = {
        name: baseArgs.name,
        band: baseArgs.band,
        broadcast: baseArgs.broadcast,
        guestNetEnable: baseArgs.guestNetEnable,
        security: baseArgs.security,
        mloEnable: baseArgs.mloEnable,
        pmfMode: baseArgs.pmfMode,
        enable11r: baseArgs.enable11r,
        vlanEnable: baseArgs.vlanEnable,
        vlanId: baseArgs.vlanId,
        pskSetting: baseArgs.pskSetting,
    };

    beforeEach(() => {
        mockServer = {
            registerTool: vi.fn((_name, _schema, handler) => {
                toolHandler = handler;
            }),
        } as unknown as McpServer;

        mockClient = {
            updateSsidBasicConfig: vi.fn(),
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

    describe('registerUpdateSsidBasicConfigTool', () => {
        it('registers the tool', () => {
            registerUpdateSsidBasicConfigTool(mockServer, mockClient);
            expect(mockServer.registerTool).toHaveBeenCalledWith('updateSsidBasicConfig', expect.any(Object), expect.any(Function));
        });

        it('forwards wlanId/ssidId as path args and the rest as body', async () => {
            const mockData = { success: true };
            (mockClient.updateSsidBasicConfig as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);
            registerUpdateSsidBasicConfigTool(mockServer, mockClient);
            const result = await toolHandler(baseArgs, { sessionId: 'test-session' });
            expect(mockClient.updateSsidBasicConfig).toHaveBeenCalledWith('wlan-1', 'ssid-1', expectedBody, undefined, undefined);
            expect(result).toEqual({ content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }] });
        });

        it('passes siteId when provided', async () => {
            (mockClient.updateSsidBasicConfig as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerUpdateSsidBasicConfigTool(mockServer, mockClient);
            await toolHandler({ ...baseArgs, siteId: 'site-x' }, { sessionId: 'test-session' });
            expect(mockClient.updateSsidBasicConfig).toHaveBeenCalledWith('wlan-1', 'ssid-1', expectedBody, 'site-x', undefined);
        });

        it('passes customHeaders when provided', async () => {
            (mockClient.updateSsidBasicConfig as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerUpdateSsidBasicConfigTool(mockServer, mockClient);
            await toolHandler({ ...baseArgs, customHeaders: { 'X-H': 'v' } }, { sessionId: 'test-session' });
            expect(mockClient.updateSsidBasicConfig).toHaveBeenCalledWith('wlan-1', 'ssid-1', expectedBody, undefined, { 'X-H': 'v' });
        });

        it('forwards open-security args with oweEnable', async () => {
            (mockClient.updateSsidBasicConfig as ReturnType<typeof vi.fn>).mockResolvedValue({});
            registerUpdateSsidBasicConfigTool(mockServer, mockClient);
            const openArgs = {
                wlanId: 'wlan-1',
                ssidId: 'ssid-1',
                name: 'PublicWifi',
                band: 3,
                broadcast: true,
                guestNetEnable: true,
                security: 0,
                oweEnable: true,
                mloEnable: false,
                pmfMode: 3,
                enable11r: false,
                vlanEnable: false,
            };
            await toolHandler(openArgs, { sessionId: 'test-session' });
            const { wlanId: _w, ssidId: _s, ...expectedOpen } = openArgs;
            expect(mockClient.updateSsidBasicConfig).toHaveBeenCalledWith('wlan-1', 'ssid-1', expectedOpen, undefined, undefined);
        });

        it('handles errors', async () => {
            (mockClient.updateSsidBasicConfig as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Invalid VLAN ID'));
            registerUpdateSsidBasicConfigTool(mockServer, mockClient);
            await expect(toolHandler(baseArgs, { sessionId: 'test-session' })).rejects.toThrow('Invalid VLAN ID');
            expect(loggerModule.logger.error).toHaveBeenCalled();
        });
    });
});
