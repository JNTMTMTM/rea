import { z } from "zod";

import { isSwiftMangledSymbolName } from "../../domain/swiftSymbolClassification.js";

const resultSchema = z.object({
  input: z.string(),
  output: z.string(),
  status: z.enum(["demangled", "unchanged", "invalid"]),
});

export type DemangledSymbol = z.infer<typeof resultSchema>;

/**
 * Preserve input ordering while parsing `swift-demangle --compact` lines.
 * The demangler ends each record with LF, so a carriage return belongs to the
 * symbol text.
 */
export const parseDemangledSymbols = (
  inputs: readonly string[],
  output: string,
): DemangledSymbol[] => {
  if (inputs.length === 0) {
    if (output === "" || output === "\n") return [];
    throw new TypeError("swift-demangle emitted output for an empty input");
  }
  const lines = output.replace(/\n$/u, "").split("\n");
  if (lines.length !== inputs.length)
    throw new TypeError("swift-demangle output count does not match input");
  return inputs.map((input, index) => {
    const value = lines[index];
    if (value === undefined)
      throw new TypeError("swift-demangle omitted an output line");
    // The command strips one underscore from `__…` and supplies `$` for bare
    // S/s/e prefixes before decoding. An echo of that spelling is not a decode.
    // Keep this command-specific normalization here, not in symbol identity.
    const demanglerInput = input.startsWith("__")
      ? input.slice(1)
      : /^[Sse]/u.test(input)
        ? `$${input}`
        : input;
    return resultSchema.parse({
      input,
      output: value,
      status:
        value === input || value === demanglerInput
          ? isSwiftMangledSymbolName(demanglerInput)
            ? "invalid"
            : "unchanged"
          : "demangled",
    });
  });
};
