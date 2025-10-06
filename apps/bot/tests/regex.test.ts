import { it, describe, expect } from "bun:test";
import { MessageLinkRegex } from "../src/helpers/regex";

describe('MessageLinkRegex', () => {
  describe('Channel links (without message ID)', () => {
    it('should match standard channel link', () => {
      const link = 'https://discord.com/channels/1385955477912948806/1424175308872876174';
      const matches = [...link.matchAll(MessageLinkRegex)];

      expect(matches).toHaveLength(1);
      expect(matches[0].groups?.guildId).toBe('1385955477912948806');
      expect(matches[0].groups?.channelId).toBe('1424175308872876174');
      expect(matches[0].groups?.messageId).toBeUndefined();
    });

    it('should match DM channel link with @me', () => {
      const link = 'https://discord.com/channels/@me/1424175308872876174';
      const matches = [...link.matchAll(MessageLinkRegex)];

      expect(matches).toHaveLength(1);
      expect(matches[0].groups?.guildId).toBe('@me');
      expect(matches[0].groups?.channelId).toBe('1424175308872876174');
      expect(matches[0].groups?.messageId).toBeUndefined();
    });

    it('should match discordapp.com domain', () => {
      const link = 'https://discordapp.com/channels/1385955477912948806/1424175308872876174';
      const matches = [...link.matchAll(MessageLinkRegex)];

      expect(matches).toHaveLength(1);
      expect(matches[0].groups?.guildId).toBe('1385955477912948806');
    });

    it('should match without https://', () => {
      const link = 'discord.com/channels/1385955477912948806/1424175308872876174';
      const matches = [...link.matchAll(MessageLinkRegex)];

      expect(matches).toHaveLength(1);
      expect(matches[0].groups?.guildId).toBe('1385955477912948806');
      expect(matches[0].groups?.channelId).toBe('1424175308872876174');
    });
  });

  describe('Message links (with message ID)', () => {
    it('should match standard message link', () => {
      const link = 'https://discord.com/channels/1385955477912948806/1424175308872876174/1424175420123456789';
      const matches = [...link.matchAll(MessageLinkRegex)];

      expect(matches).toHaveLength(1);
      expect(matches[0].groups?.guildId).toBe('1385955477912948806');
      expect(matches[0].groups?.channelId).toBe('1424175308872876174');
      expect(matches[0].groups?.messageId).toBe('1424175420123456789');
    });

    it('should match DM message link with @me', () => {
      const link = 'https://discord.com/channels/@me/1424175308872876174/1424175420123456789';
      const matches = [...link.matchAll(MessageLinkRegex)];

      expect(matches).toHaveLength(1);
      expect(matches[0].groups?.guildId).toBe('@me');
      expect(matches[0].groups?.channelId).toBe('1424175308872876174');
      expect(matches[0].groups?.messageId).toBe('1424175420123456789');
    });

    it('should match message link with 17-digit IDs', () => {
      const link = 'https://discord.com/channels/12345678901234567/12345678901234567/12345678901234567';
      const matches = [...link.matchAll(MessageLinkRegex)];

      expect(matches).toHaveLength(1);
      expect(matches[0].groups?.guildId).toBe('12345678901234567');
      expect(matches[0].groups?.channelId).toBe('12345678901234567');
      expect(matches[0].groups?.messageId).toBe('12345678901234567');
    });

    it('should match message link with 20-digit IDs', () => {
      const link = 'https://discord.com/channels/12345678901234567890/12345678901234567890/12345678901234567890';
      const matches = [...link.matchAll(MessageLinkRegex)];

      expect(matches).toHaveLength(1);
      expect(matches[0].groups?.guildId).toBe('12345678901234567890');
      expect(matches[0].groups?.channelId).toBe('12345678901234567890');
      expect(matches[0].groups?.messageId).toBe('12345678901234567890');
    });
  });

  describe('Multiple matches in text', () => {
    it('should match multiple links in a string', () => {
      const text = 'Check out https://discord.com/channels/1385955477912948806/1424175308872876174 and https://discord.com/channels/1385955477912948806/1424521073852026890/1424521282946334733';
      const matches = [...text.matchAll(MessageLinkRegex)];

      expect(matches).toHaveLength(2);
      expect(matches[0].groups?.guildId).toBe('1385955477912948806');
      expect(matches[0].groups?.channelId).toBe('1424175308872876174');
      expect(matches[0].groups?.messageId).toBeUndefined();

      expect(matches[1].groups?.guildId).toBe('1385955477912948806');
      expect(matches[1].groups?.channelId).toBe('1424521073852026890');
      expect(matches[1].groups?.messageId).toBe('1424521282946334733');
    });

    it('should work with map like in your code', () => {
      const message = {
        content: 'Look at https://discord.com/channels/1385955477912948806/1424175308872876174 and https://discord.com/channels/1385955477912948806/1424521073852026890/1424521282946334733'
      };
      const links = [...message.content.matchAll(MessageLinkRegex)].map(m => ({ ...m.groups }));

      console.log("--------------------- invalid link")
      console.log({ links });
      expect(links).toHaveLength(2);
      expect(links[0]).toEqual({
        guildId: '1385955477912948806',
        channelId: '1424175308872876174',
        messageId: undefined
      });
      expect(links[1]).toEqual({
        guildId: '1385955477912948806',
        channelId: '1424521073852026890',
        messageId: '1424521282946334733'
      });
    });

    it('should match both channel and message links together', () => {
      const text = 'Channel: https://discord.com/channels/1385955477912948806/1424175308872876174 Message: https://discord.com/channels/1385955477912948806/1424521073852026890/1424521282946334733';
      const links = [...text.matchAll(MessageLinkRegex)].map(m => ({ ...m.groups }));

      expect(links).toHaveLength(2);
      expect(links[0].messageId).toBeUndefined();
      expect(links[1].messageId).toBe('1424521282946334733');
    });
  });

  describe('Invalid links', () => {
    it('should not match with invalid domain', () => {
      const link = 'https://notdiscord.com/channels/1385955477912948806/1424175308872876174';

      const matches = [...link.matchAll(MessageLinkRegex)];
      console.log({ matches: matches.map((m => m.groups)) })
      expect(matches).toHaveLength(0);
    });

    it('should not match with too short IDs (16 digits)', () => {
      const link = 'https://discord.com/channels/1234567890123456/1234567890123456';
      const matches = [...link.matchAll(MessageLinkRegex)];

      expect(matches).toHaveLength(0);
    });

    it('should not match with too long IDs (21 digits)', () => {
      const link = 'https://discord.com/channels/123456789012345678901/123456789012345678901';
      const matches = [...link.matchAll(MessageLinkRegex)];

      expect(matches).toHaveLength(0);
    });

    it('should not match with only one segment', () => {
      const link = 'https://discord.com/channels/1385955477912948806';
      const matches = [...link.matchAll(MessageLinkRegex)];

      expect(matches).toHaveLength(0);
    });

    it('should not match with non-numeric channel/message IDs', () => {
      const link = 'https://discord.com/channels/1385955477912948806/notanumber';
      const matches = [...link.matchAll(MessageLinkRegex)];

      expect(matches).toHaveLength(0);
    });
  });
});
