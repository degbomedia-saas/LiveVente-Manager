import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  webpack: (config) => {
    for (const rule of config.module?.rules ?? []) {
      if (rule && typeof rule === "object" && Array.isArray(rule.oneOf)) {
        for (const subRule of rule.oneOf) {
          const uses = Array.isArray(subRule.use) ? subRule.use : [];
          const hasCssLoader = uses.some(
            (u: unknown) =>
              typeof u === "object" &&
              u !== null &&
              "loader" in u &&
              typeof (u as { loader?: unknown }).loader === "string" &&
              (u as { loader: string }).loader.includes("css-loader")
          );
          if (hasCssLoader) {
            subRule.use = [...uses, "@tailwindcss/turbopack"];
          }
        }
      }
    }
    return config;
  },
};

export default nextConfig;
