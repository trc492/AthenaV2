import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

// eslint-plugin-react 7 still uses context helpers removed in ESLint 10.
// Keep the compatible Next.js, hooks, accessibility, and TypeScript rules.
const eslintConfig = [...nextVitals, ...nextTypeScript];
for (const config of eslintConfig) {
  for (const ruleName of Object.keys(config.rules ?? {})) {
    if (ruleName.startsWith("react/")) delete config.rules[ruleName];
  }
}

export default eslintConfig;
