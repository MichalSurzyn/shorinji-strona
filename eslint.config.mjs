import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Linki tylko przez components/Odnosnik (prefetch wylaczony): kazdy prefetch na
  // Netlify to wywolanie funkcji, a plan Free ma limit 125 000 na miesiac.
  {
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{ name: "next/link", message: "Uzyj @/components/Odnosnik - prefetch wylaczony ze wzgledu na limit funkcji Netlify." }],
      }],
    },
  },
  {
    files: ["components/Odnosnik.tsx"],
    rules: { "no-restricted-imports": "off" },
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
