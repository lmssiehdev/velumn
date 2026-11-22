import { Context, Effect, Layer } from "effect";

export const version = "0.0.0";

export class Health extends Context.Service<
  Health,
  {
    readonly status: Effect.Effect<{
      readonly ok: true;
      readonly version: string;
      readonly uptimeSeconds: number;
    }>;
  }
>()("velumn/Health") {
  static readonly layer = Layer.sync(Health, () => {
    const startedAt = Date.now();
    return Health.of({
      status: Effect.sync(() => ({
        ok: true as const,
        version,
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      })),
    });
  });
}
