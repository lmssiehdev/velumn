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
            "ImportDeclaration[source.value='react'] > ImportSpecifier[imported.name='useEffect']",
          message:
            "Model state through loaders, queries, events, or external-store subscriptions instead.",
        },
        {
          selector:
            "CallExpression[callee.object.name='React'][callee.property.name='useEffect']",
          message:
            "Model state through loaders, queries, events, or external-store subscriptions instead.",
        },
      ],
    },
  },
  {
    ignores: ["eslint.config.js", ".prettierrc"],
  },
]
