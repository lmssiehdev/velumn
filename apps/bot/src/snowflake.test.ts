/** biome-ignore-all lint/style/noMagicNumbers: <explanation> */

import { describe, expect, it } from 'vitest';
import { getTheOldestSnowflakeId } from './core/indexing';

const DISCORD_EPOCH = 420070400000n; // January 1, 2015 00:00:00 UTC in millisectodatodaynds

function generateDiscordSnowflake(
  timestamp: number,
  direction: 'after' | 'before' = 'after'
) {
  if (direction !== 'before' && direction !== 'after') {
    throw new Error("Direction must be 'before' or 'after'");
  }
  const timestampMs = timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;

  const discordTimestamp = BigInt(timestampMs) - DISCORD_EPOCH;

  // Discord snowflake structure:
  // 42 bits: timestamp (milliseconds since Discord epoch)
  // 5 bits: internal worker id (we'll use 0)
  // 5 bits: internal process id (we'll use 0)
  // 12 bits: increment (for multiple IDs in same millisecond)

  const increment = direction === 'before' ? 0n : 4095n;

  // Shift timestamp left by 22 bits (5 + 5 + 12) and add the increment
  // biome-ignore lint/suspicious/noBitwiseOperators: <explanation>
  const snowflake = (discordTimestamp << 22n) | increment;

  return snowflake.toString();
}

describe('getTheLastMessageId', () => {
  it('should return "0" for empty array', () => {
    const result = getTheOldestSnowflakeId([]);
    expect(result).toBe('0');
  });

  it('should return single message id', () => {
    const timestamp = Date.now();
    const snowflake = generateDiscordSnowflake(timestamp);

    const result = getTheOldestSnowflakeId([{ id: snowflake }]);
    expect(result).toBe(snowflake);
  });

  it('should return the largest snowflake from chronologically ordered messages', () => {
    const now = Date.now();
    const messages = [
      { id: generateDiscordSnowflake(now - 3000) }, // 3 seconds ago
      { id: generateDiscordSnowflake(now - 2000) }, // 2 seconds ago
      { id: generateDiscordSnowflake(now - 1000) }, // 1 second ago
      { id: generateDiscordSnowflake(now) }, // now
    ];

    const result = getTheOldestSnowflakeId(messages);
    expect(result).toBe(generateDiscordSnowflake(now));
  });

  it('should return the largest snowflake from reverse chronologically ordered messages', () => {
    const now = Date.now();
    const messages = [
      { id: generateDiscordSnowflake(now) }, // now (should be returned)
      { id: generateDiscordSnowflake(now - 1000) }, // 1 second ago
      { id: generateDiscordSnowflake(now - 2000) }, // 2 seconds ago
      { id: generateDiscordSnowflake(now - 3000) }, // 3 seconds ago
    ];

    const result = getTheOldestSnowflakeId(messages);
    expect(result).toBe(generateDiscordSnowflake(now));
  });

  it('should return the largest snowflake from randomly ordered messages', () => {
    const now = Date.now();
    const messages = [
      { id: generateDiscordSnowflake(now - 2000) }, // 2 seconds ago
      { id: generateDiscordSnowflake(now) }, // now (should be returned)
      { id: generateDiscordSnowflake(now - 3000) }, // 3 seconds ago
      { id: generateDiscordSnowflake(now - 1000) }, // 1 second ago
    ];

    const result = getTheOldestSnowflakeId(messages);
    expect(result).toBe(generateDiscordSnowflake(now));
  });

  it('should handle messages with same timestamp but different increments', () => {
    const timestamp = Date.now();
    const messages = [
      { id: generateDiscordSnowflake(timestamp, 'before') }, // increment = 0
      { id: generateDiscordSnowflake(timestamp, 'after') }, // increment = 4095
    ];

    const result = getTheOldestSnowflakeId(messages);
    expect(result).toBe(generateDiscordSnowflake(timestamp, 'after'));
  });

  it('should work with very old Discord messages', () => {
    // January 2015 (right after Discord epoch)
    const oldTimestamp = 1_420_070_400_000; // Jan 1, 2015
    const newTimestamp = Date.now();

    const messages = [
      { id: generateDiscordSnowflake(newTimestamp) },
      { id: generateDiscordSnowflake(oldTimestamp) },
    ];

    const result = getTheOldestSnowflakeId(messages);
    expect(result).toBe(generateDiscordSnowflake(newTimestamp));
  });

  it('should handle large arrays efficiently', () => {
    const now = Date.now();
    const messages: { id: string }[] = [];

    // Create 1000 messages with timestamps going backwards
    for (let i = 0; i < 1000; i++) {
      messages.push({ id: generateDiscordSnowflake(now - i * 1000) });
    }

    // The first message (index 0) should be the newest
    const result = getTheOldestSnowflakeId(messages);
    expect(result).toBe(generateDiscordSnowflake(now));
  });

  it('should not mutate the original array', () => {
    const now = Date.now();
    const messages = [
      { id: generateDiscordSnowflake(now - 2000) },
      { id: generateDiscordSnowflake(now - 1000) },
      { id: generateDiscordSnowflake(now) },
    ];

    const originalOrder = messages.map((m) => m.id);
    getTheOldestSnowflakeId(messages);

    // Check that original array order is unchanged
    expect(messages.map((m) => m.id)).toEqual(originalOrder);
  });

  it('should work with string comparisons that would be wrong', () => {
    // This tests the BigInt comparison vs string comparison
    const messages = [
      { id: '9' }, // String comparison would say this is largest
      { id: '10' }, // But numerically this should be largest
      { id: '2' },
    ];

    const result = getTheOldestSnowflakeId(messages);
    expect(result).toBe('10'); // Should be '10', not '9'
  });

  it('should handle edge case snowflakes', () => {
    const messages = [
      { id: '0' }, // Minimum possible
      { id: '9223372036854775807' }, // Close to max safe integer
      { id: '1' },
    ];

    const result = getTheOldestSnowflakeId(messages);
    expect(result).toBe('9223372036854775807');
  });
});
