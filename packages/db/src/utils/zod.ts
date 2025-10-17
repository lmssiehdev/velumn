import z from "zod";

export const collectionToRecord = <T extends z.ZodObject>(schema: T) =>
    z
        .any()
        .optional()
        .transform((collection) => {
            if (!collection || collection.size === 0) return undefined;

            const arr = Array.from(collection.values());
            const parsed = z.array(z.object({ id: z.coerce.string() }).and(schema)).safeParse(arr);

            if (!parsed.success) {
                console.log('collection_to_record_schema_failed', parsed.error);
                return undefined;
            }

            return parsed.data.reduce(
                (acc, { id, ...rest }) => {
                    acc[id] = rest as z.infer<T>;
                    return acc;
                },
                {} as Record<string, z.infer<T>>
            );
        });

export const collectionToArray = <T extends z.ZodObject>(schema: T) =>
    z
        .any()
        .optional()
        .transform((collection) => {
            if (!collection) return undefined;

            const arr = collection instanceof Map
                ? Array.from(collection.values())
                : Array.isArray(collection)
                    ? collection
                    : [];

            if (arr.length === 0) return undefined;

            const parsed = z.array(schema).safeParse(arr);

            if (!parsed.success) {
                console.log(
                    'collection_to_array_schema_failed',
                    z.prettifyError(parsed.error)
                );
                return undefined;
            }

            return parsed.data;
        });

export function removeUndefinedValues<T extends Record<string, any>>(
    data: T
): Partial<T> | null {
    const entries = Object.entries(data).filter(([_, v]) => v !== undefined);
    return entries.length ? Object.fromEntries(entries) as Partial<T> : null;
}