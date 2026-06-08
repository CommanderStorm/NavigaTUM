import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests cover the pure logic in `app/utils` and `app/composables` (no Nuxt runtime needed), so
// they live outside `app/` to stay clear of Nuxt's auto-import scanning. The `~` alias mirrors
// Nuxt's so those pure modules can keep their idiomatic `~/...` imports under test.
export default defineConfig({
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./app", import.meta.url)),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
