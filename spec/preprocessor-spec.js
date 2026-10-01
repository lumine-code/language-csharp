describe("C# Tree-sitter preprocessor directives", () => {
  let editor;

  beforeEach(async () => {
    await lumine.packages.activatePackage("language-csharp");
  });

  afterEach(() => editor?.destroy());

  async function setUp(lines) {
    editor = await lumine.workspace.open("preprocessor.cs");
    editor.setText(`${lines.join("\n")}\n`);
    expect(await editor.whenGrammarSettled()).toBe(true);
    expect(editor.getGrammar().scopeName).toBe("source.cs");
    const root = editor.getSyntaxNodeAtBufferPosition([0, 0], (node) => !node.parent);
    expect(root?.hasError).toBe(false);
  }

  function scopesAt(row, text, offset = 0) {
    const column = editor.lineTextForBufferRow(row).indexOf(text);
    expect(column).not.toBe(-1);
    return editor.scopeDescriptorForBufferPosition([row, column + offset]).getScopesArray();
  }

  function expectFold(row, endRow) {
    const range = editor.getFoldableRangeAtBufferRow(row);
    expect(range).not.toBeNull();
    expect(range && [range.start.row, range.end.row]).toEqual([row, endRow]);
  }

  it("scopes the complete shebang without treating the following code as a comment", async () => {
    await setUp(["#!/usr/bin/env dotnet", "Console.WriteLine(1);"]);

    expect(scopesAt(0, "#!")).toContain("comment.line.shebang.cs");
    expect(scopesAt(0, "dotnet")).toContain("comment.line.shebang.cs");
    expect(scopesAt(1, "Console")).not.toContain("comment.line.shebang.cs");
  });

  it("scopes every supported directive keyword without extending into its argument", async () => {
    const directives = [
      ["#define FEATURE", "#define", "definition"],
      ["#undef OLD_FEATURE", "#undef", "definition"],
      ['#line 42 "generated.cs"', "#line", "line"],
      ["#pragma warning disable 0168", "#pragma", "pragma"],
      ["#nullable enable", "#nullable", "nullable"],
      ["#region Features", "#region", "region"],
      ["#if FEATURE", "#if", "conditional"],
      ["class First {}"],
      ["#elif ALTERNATIVE", "#elif", "conditional"],
      ["class Second {}"],
      ["#else", "#else", "conditional"],
      ["class Other {}"],
      ["#endif", "#endif", "conditional"],
      ["#endregion", "#endregion", "region"],
      ["class After {}"],
    ];
    await setUp(directives.map(([line]) => line));

    for (const [row, [line, keyword, kind]] of directives.entries()) {
      if (!keyword) continue;
      const scope = `keyword.control.directive.${kind}.cs`;
      expect(scopesAt(row, keyword)).toContain(scope);
      expect(scopesAt(row, keyword, keyword.length - 1)).toContain(scope);
      if (line.length > keyword.length) {
        expect(scopesAt(row, keyword, keyword.length + 1)).not.toContain(scope);
      }
    }
  });

  it("keeps directive-like text in strings and comments out of directive scopes", async () => {
    await setUp([
      'var text = "#if #define #region #pragma #nullable";',
      "// #if #define #region #pragma #nullable",
    ]);

    for (const row of [0, 1]) {
      for (const [keyword, kind] of [
        ["#if", "conditional"],
        ["#define", "definition"],
        ["#region", "region"],
        ["#pragma", "pragma"],
        ["#nullable", "nullable"],
      ]) {
        expect(scopesAt(row, keyword)).not.toContain(`keyword.control.directive.${kind}.cs`);
      }
    }
  });

  it("matches nested regions and leaves their closing directives visible", async () => {
    await setUp([
      "#region Outer",
      "class Example {",
      "  #region Inner",
      "  int value;",
      "  #endregion",
      "}",
      "#endregion",
      "class Outside {}",
    ]);

    expectFold(0, 5);
    expectFold(2, 3);
    expect(editor.getFoldableRangeAtBufferRow(4)).toBeNull();
    expect(editor.getFoldableRangeAtBufferRow(6)).toBeNull();

    editor.foldBufferRow(2);
    expect(editor.isFoldedAtBufferRow(2)).toBe(true);
    expect(editor.isFoldedAtBufferRow(4)).toBe(false);
    editor.foldBufferRow(0);
    expect(editor.lineTextForScreenRow(1)).toBe("#endregion");
  });

  it("folds each nested conditional branch up to the next directive at the same level", async () => {
    await setUp([
      "#if OUTER",
      "#if INNER",
      "class Inner {}",
      "#elif SECOND",
      "class Second {}",
      "#else",
      "class Fallback {}",
      "#endif",
      "#elif OUTER_SECOND",
      "class Other {}",
      "#else",
      "class Last {}",
      "#endif",
      "class Outside {}",
    ]);

    for (const [row, endRow] of [
      [0, 7],
      [1, 2],
      [3, 4],
      [5, 6],
      [8, 9],
      [10, 11],
    ]) {
      expectFold(row, endRow);
    }
    expect(editor.getFoldableRangeAtBufferRow(7)).toBeNull();
    expect(editor.getFoldableRangeAtBufferRow(12)).toBeNull();

    editor.foldBufferRow(1);
    expect(editor.isFoldedAtBufferRow(1)).toBe(true);
    expect(editor.isFoldedAtBufferRow(3)).toBe(false);
    editor.foldBufferRow(0);
    expect(editor.lineTextForScreenRow(1)).toBe("#elif OUTER_SECOND");
  });

  it("keeps region and conditional boundaries paired when they are nested together", async () => {
    await setUp([
      "#region Outer",
      "#if FEATURE",
      "#region Inner",
      "class Example {}",
      "#endregion",
      "#else",
      "class Alternative {}",
      "#endif",
      "#endregion",
      "class Outside {}",
    ]);

    expectFold(0, 7);
    expectFold(1, 4);
    expectFold(2, 3);
    expectFold(5, 6);

    editor.foldBufferRow(1);
    expect(editor.lineTextForScreenRow(2)).toBe("#else");
  });

  it("preserves folding of declaration lists, accessor lists, and nested blocks", async () => {
    await setUp([
      "class Example {",
      "  int Value {",
      "    get {",
      "      return 1;",
      "    }",
      "    set {",
      "      Consume(value);",
      "    }",
      "  }",
      "  void Consume(int value) {",
      "    if (value > 0) {",
      "      value--;",
      "    }",
      "  }",
      "}",
    ]);

    for (const [row, endRow] of [
      [0, 14],
      [1, 8],
      [2, 4],
      [5, 7],
      [9, 13],
      [10, 12],
    ]) {
      expectFold(row, endRow);
    }
  });
});
