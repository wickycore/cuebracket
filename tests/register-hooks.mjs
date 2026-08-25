import { registerHooks } from "node:module";

const projectRoot = new URL("../", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    return nextResolve(new URL(`${specifier.slice(2)}.ts`, projectRoot).href, context);
  },
});
