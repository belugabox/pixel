import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  js.configs.recommended,
  ...compat.config({
    env: {
      browser: true,
      es6: true,
      node: true,
    },
    parser: "@typescript-eslint/parser",
    extends: [
      "plugin:@typescript-eslint/eslint-recommended",
      "plugin:@typescript-eslint/recommended",
      "plugin:import/recommended",
      "plugin:import/electron",
      "plugin:import/typescript",
    ],
    overrides: [
      {
        files: ["*.config.ts", "forge.config.ts", "vite.*.config.ts", "src/main.ts", "src/preload.ts", "scripts/*.js", "src/services/xinput-native-addon.ts"],
        rules: {
          "@typescript-eslint/no-require-imports": "off",
          "import/no-unresolved": "off",
          "import/no-commonjs": "off",
        },
      },
      {
        files: ["src/**/*.ts", "src/**/*.tsx"],
        rules: {
          "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
          "no-empty": "off",
          "@typescript-eslint/no-unused-expressions": "off",
        },
      },
    ],
    rules: {
      "// Règles personnalisées pour le projet - commentaires requis en français": "off",
    },
  }),
  {
    ignores: [
      ".vite/**",
      "dist-native/**",
      "node_modules/**",
      "out/**",
      "**/*.d.ts",
    ],
  },
];
