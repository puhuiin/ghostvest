import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["*.test.ts"],
    environment: "node",
    testTimeout: 30000,
  },
  deps: {
    inline: ["@solana/web3.js"],
  },
});
