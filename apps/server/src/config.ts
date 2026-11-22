/** Settings read from the environment. A bad value stops startup. */
import { Config } from "effect";

export const HttpConfig = Config.all({
  host: Config.String("HOST").pipe(Config.withDefault("127.0.0.1")),
  port: Config.Port("PORT").pipe(Config.withDefault(3000)),
  token: Config.Redacted("VELUMN_TOKEN"),
});
