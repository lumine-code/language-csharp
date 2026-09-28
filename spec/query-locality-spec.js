const fs = require("fs");
const path = require("path");
const { Point } = require("lumine");

describe("C# highlight query locality", () => {
  let editor;

  beforeEach(async () => {
    await lumine.packages.activatePackage("language-csharp");
    editor = await lumine.workspace.open();
    editor.setGrammar(lumine.grammars.grammarForScopeName("source.cs"));
  });

  afterEach(() => editor?.destroy());

  async function setUp(text) {
    editor.setText(text);
    await editor.languageMode.ready;
  }

  async function capturesForRows(startRow, endRow) {
    const groups = await editor.getGrammarQueryCaptureGroups("highlightsQuery", {
      startPosition: new Point(startRow, 0),
      endPosition: new Point(endRow, 0),
    });
    return groups.find(({ grammar }) => grammar === editor.getGrammar())?.captures ?? [];
  }

  it("keeps generic delimiters local inside 6000 type arguments", async () => {
    const query = fs.readFileSync(
      path.join(__dirname, "..", "grammars", "csharp-highlights.scm"),
      "utf8",
    );
    expect(query).not.toContain("((type_argument_list\n");
    expect(query).not.toContain("((type_parameter_list\n");
    expect(query).not.toMatch(/^\(type_parameter_list\b/m);
    expect(query).not.toMatch(/^\(bracketed_parameter_list\b/m);
    expect(query).not.toMatch(/\(_\s+type:\s*\(_\)/);
    expect(query).not.toMatch(/\(_\s+returns:\s*\(_\)/);
    expect(query).toContain("(#is? test.field type)");
    expect(query).toContain("(#is? test.field returns)");

    await setUp("class Example { Generic<Type> field; }");
    expect(editor.scopeDescriptorForBufferPosition([0, 23]).getScopesArray()).toContain(
      "punctuation.definition.parameters.begin.bracket.angle.cs",
    );
    expect(editor.scopeDescriptorForBufferPosition([0, 28]).getScopesArray()).toContain(
      "punctuation.definition.parameters.end.bracket.angle.cs",
    );

    const lines = ["class Example {", "  Generic<"];
    for (let i = 0; i < 6000; i++) lines.push(`    Type${i}${i === 5999 ? "" : ","}`);
    lines.push("  > field;", "}");
    await setUp(lines.join("\r\n"));
    expect((await editor.getSyntaxDiagnostics()).hasError).toBe(false);
    expect((await capturesForRows(2999, 3005)).length).toBeLessThanOrEqual(96);

    const parameterLines = ["class Example<"];
    for (let i = 0; i < 6000; i++) {
      parameterLines.push(`  Type${i}${i === 5999 ? "" : ","}`);
    }
    parameterLines.push("> {}");
    await setUp(parameterLines.join("\r\n"));
    expect((await editor.getSyntaxDiagnostics()).hasError).toBe(false);
    expect((await capturesForRows(2998, 3004)).length).toBeLessThanOrEqual(96);
    expect(
      (await capturesForRows(2998, 3004))
        .filter((capture) => capture.name === "support.storage.type.parameter.cs")
        .every(
          (capture) =>
            capture.node.startPosition.row >= 2998 && capture.node.startPosition.row < 3004,
        ),
    ).toBe(true);

    const indexerLines = ["class Example {", "  int this["];
    for (let i = 0; i < 6000; i++) {
      indexerLines.push(`    int value${i}${i === 5999 ? "" : ","}`);
    }
    indexerLines.push("  ] => 0;", "}");
    await setUp(indexerLines.join("\r\n"));
    expect((await editor.getSyntaxDiagnostics()).hasError).toBe(false);
    expect((await capturesForRows(2999, 3005)).length).toBeLessThanOrEqual(112);
  });

  it("keeps interpolation captures local inside a 6000-row interpolated string", async () => {
    const query = fs.readFileSync(
      path.join(__dirname, "..", "grammars", "csharp-highlights.scm"),
      "utf8",
    );
    expect(query).not.toContain("(interpolated_string_expression (interpolation_quote)");
    expect(query).not.toMatch(/\(interpolated_string_expression\s+\(interpolation\)/);
    expect(query).toContain(
      '(#is? test.typeAt "firstNamedChild.nextNamedSibling interpolation_quote")',
    );

    const lines = ['var value = $$"""'];
    for (let i = 0; i < 6000; i++) lines.push(`line {{value_${i}}}`);
    lines.push('""";');
    await setUp(lines.join("\r\n"));

    expect((await editor.getSyntaxDiagnostics()).hasError).toBe(false);
    const captures = await capturesForRows(2998, 3004);
    expect(captures.length).toBeLessThanOrEqual(160);
    expect(
      captures
        .filter((capture) => capture.name.startsWith("meta.embedded."))
        .every(
          (capture) =>
            capture.node.startPosition.row >= 2998 && capture.node.startPosition.row < 3004,
        ),
    ).toBe(true);
  });
});
