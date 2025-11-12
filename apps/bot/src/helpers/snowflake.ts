import type { Snowflake } from "discord.js";

export function isSnowflakeLargerAsInt(a: Snowflake, b: Snowflake) {
	return isSnowflakeLarger(a, b) ? (isSnowflakeLarger(a, b) ? 1 : 0) : -1;
}

export function isSnowflakeLarger(a: Snowflake, b: Snowflake) {
	const aAsBigInt = BigInt(a);
	const bAsBigInt = BigInt(b);
	return aAsBigInt > bAsBigInt;
}
