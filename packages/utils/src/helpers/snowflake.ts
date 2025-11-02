type Snowflake = string;

export function isSnowflakeLargerAsInt(a: Snowflake, b: Snowflake) {
  return isSnowflakeLarger(a, b) ? (isSnowflakeLarger(a, b) ? 1 : 0) : -1;
}

export function isSnowflakeLarger(a: Snowflake, b: Snowflake) {
  const aAsBigInt = BigInt(a);
  const bAsBigInt = BigInt(b);
  return aAsBigInt > bAsBigInt;
}

export const EPOCH = BigInt(1_420_070_400_000);

export function getTimestamp(snowflake: Snowflake) {
  const snowflakeBigInt = BigInt(snowflake);
  const timestampBits = snowflakeBigInt >> 22n;
  const fullTimestamp = timestampBits + EPOCH;
  return Number(fullTimestamp);
}

export function getDateFromSnowflake(snowflake: Snowflake) {
  return new Date(getTimestamp(snowflake));
}
