import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/src/")) {
    const relativePath = specifier.slice("@/".length);
    const filePath = `${process.cwd()}/${relativePath}`;
    if (filePath.endsWith(".ts")) {
      return nextResolve(pathToFileURL(filePath).href, context);
    }
    if (existsSync(`${filePath}.ts`)) {
      return nextResolve(pathToFileURL(`${filePath}.ts`).href, context);
    }
    if (existsSync(`${filePath}/index.ts`)) {
      return nextResolve(pathToFileURL(`${filePath}/index.ts`).href, context);
    }
  }

  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const parentDir = dirname(fileURLToPath(context.parentURL));
    const filePath = resolvePath(parentDir, specifier);
    if (!specifier.endsWith(".ts") && existsSync(`${filePath}.ts`)) {
      return nextResolve(pathToFileURL(`${filePath}.ts`).href, context);
    }
    if (!specifier.endsWith(".ts") && existsSync(`${filePath}/index.ts`)) {
      return nextResolve(pathToFileURL(`${filePath}/index.ts`).href, context);
    }
  }

  return nextResolve(specifier, context);
}
