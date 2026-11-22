import { Config } from "effect";

export const ServerConfig = Config.all({
  host: Config.String("HOST").pipe(Config.withDefault("0.0.0.0")),
  port: Config.Int("PORT").pipe(Config.withDefault(3000)),
});
