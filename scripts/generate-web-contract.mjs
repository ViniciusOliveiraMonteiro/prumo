import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import openapiTS, { astToString } from "openapi-typescript";

const inputPath = resolve("contracts/openapi.json");
const outputPath = resolve("prumo-web/src/lib/api/generated.ts");
const schema = JSON.parse(await readFile(inputPath, "utf8"));
const contents = astToString(await openapiTS(schema, { silent: true }));

if (process.argv.includes("--check")) {
  const committed = await readFile(outputPath, "utf8");
  if (committed !== contents) {
    throw new Error(
      "Tipos da web desatualizados. Execute pnpm contract:generate.",
    );
  }
} else {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, contents);
}
