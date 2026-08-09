//  @ts-check

import { tanstackConfig } from "@tanstack/eslint-config"

export default [
  ...tanstackConfig,
  {
    rules: {
      "import/no-cycle": "off",
      "import/order": "off",
      "import/consistent-type-specifier-style": "off",
      "sort-imports": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/require-await": "off",
      "pnpm/json-enforce-catalog": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ImportDeclaration[source.value='react'] > ImportSpecifier[imported.name=/^(useEffect|useLayoutEffect)$/]",
          message:
            "Model state through loaders, queries, events, or external-store subscriptions instead.",
        },
        {
          selector:
            "MemberExpression[property.name=/^(useEffect|useLayoutEffect)$/]",
          message:
            "Model state through loaders, queries, events, or external-store subscriptions instead.",
        },
      ],
    },
  },
  {
    files: [
      "src/components/**/*.{ts,tsx}",
      "src/features/**/*.tsx",
      "src/features/**/*.{client,query-options}.ts",
      "src/features/**/queries.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "node:*",
                "@repo/db",
                "@repo/db/**",
                "@vercel/sdk",
                "@/lib/auth",
                "@/lib/server-auth",
                "@/env.server",
                "@/features/*/server",
              ],
              message:
                "Browser views must consume serializable contracts, query options, or client adapters instead of server implementations.",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "src/features/**/server.ts",
      "src/features/publishing/vercel.ts",
      "src/**/*.server.ts",
      "src/lib/auth.ts",
      "src/lib/server-auth.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/components/**",
                "@/routes/**",
                "@/lib/auth-client",
                "**/*.client",
              ],
              message:
                "Server modules cannot depend on React views, route modules, or browser clients.",
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [".output/**", ".vercel/**", "eslint.config.js"],
  },
]
