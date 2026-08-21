import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function sourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.(ts|tsx|json|md)$/.test(entry.name) ? [fullPath] : [];
  }));
  return nested.flat();
}

describe("Google-only runtime", () => {
  it("contains no Supabase imports, environment variables, or dependencies", async () => {
    const files = [
      ...(await sourceFiles("app")),
      ...(await sourceFiles("components")),
      ...(await sourceFiles("lib")),
      "package.json",
      ".env.example",
      "README.md",
    ];
    const contents = await Promise.all(files.map((file) => readFile(file, "utf8")));
    expect(contents.join("\n")).not.toMatch(/@supabase|createSupabase|SUPABASE_/i);
  });
});
