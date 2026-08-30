import mdx from "@mdx-js/rollup"
import rehypeSlug from "rehype-slug"
import { defineConfig } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { nitro } from "nitro/vite"

const config = defineConfig(({ mode }) => ({
  resolve: {
    tsconfigPaths: true,
    dedupe: ["react", "react-dom", "better-auth", "@better-auth/core"],
  },
  plugins: [
    { ...mdx({ rehypePlugins: [rehypeSlug] }), enforce: "pre" },
    devtools(),
    tailwindcss(),
    tanstackStart({
      router: {
        codeSplittingOptions: {
          defaultBehavior: [
            ["loader"],
            ["component"],
            ["pendingComponent"],
            ["errorComponent"],
            ["notFoundComponent"],
          ],
        },
      },
    }),
    ...(mode === "test" ? [] : [nitro()]),
    viteReact({ include: /\.(js|jsx|md|mdx|ts|tsx)$/ }),
  ],
}))

export default config
