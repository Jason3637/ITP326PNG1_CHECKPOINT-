import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // A concise arrow in a Vitest hook returns its value - and Vitest runs a
    // function returned from beforeEach/beforeAll as a cleanup callback. So
    // beforeEach(() => mock.mockReset()) silently calls the mock again after
    // every test (mockReset returns the mock). Require a block body.
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name=/^(before|after)(Each|All)$/] > ArrowFunctionExpression[expression=true]",
          message: "Use a block body in test hooks: beforeEach(() => { ... }). A returned function is run as cleanup.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
