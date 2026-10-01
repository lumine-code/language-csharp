describe("C# Tree-sitter annotation injections", () => {
  let editor;

  beforeEach(async () => {
    await lumine.packages.activatePackage("language-hyperlink");
    await lumine.packages.activatePackage("language-todo");
    await lumine.packages.activatePackage("language-csharp");
  });

  afterEach(async () => {
    editor?.destroy();
    editor = null;
    await lumine.packages.activatePackage("language-hyperlink");
    await lumine.packages.activatePackage("language-todo");
    await lumine.packages.activatePackage("language-csharp");
  });

  async function setUp(text) {
    editor = await lumine.workspace.open();
    editor.setText(text);
    expect(lumine.grammars.assignLanguageMode(editor.getBuffer(), "source.cs")).toBe(true);
    expect(await editor.whenGrammarSettled()).toBe(true);
  }

  function scopesAt(needle, occurrence = 0) {
    const text = editor.getText();
    let index = -1;
    for (let count = 0; count <= occurrence; count++) index = text.indexOf(needle, index + 1);
    expect(index).toBeGreaterThanOrEqual(0);
    return editor
      .scopeDescriptorForBufferPosition(editor.getBuffer().positionForCharacterIndex(index))
      .getScopesArray();
  }

  async function annotationGroups() {
    const groups = await editor.getGrammarQueryCaptureGroups("highlightsQuery");
    return groups.filter(({ grammar }) =>
      ["text.hyperlink", "text.todo"].includes(grammar.scopeName),
    );
  }

  async function expectAnnotations(scopeNames) {
    const groups = await annotationGroups();
    expect(groups.map(({ grammar }) => grammar.scopeName).sort()).toEqual([...scopeNames].sort());
    for (const { grammar, captures } of groups) {
      expect(grammar).toBe(lumine.grammars.grammarForScopeName(grammar.scopeName));
      expect(captures.length).toBeGreaterThan(0);
    }
  }

  it("highlights annotations in line and block comments and links in ordinary strings", async () => {
    await setUp(
      [
        "// TODO https://example.com/line",
        "/* TODO finish this block",
        "   https://example.com/block */",
        'var url = "TODO https://example.com/string";',
      ].join("\n"),
    );

    await expectAnnotations([
      "text.hyperlink",
      "text.hyperlink",
      "text.hyperlink",
      "text.todo",
      "text.todo",
    ]);
    for (const occurrence of [0, 1]) {
      expect(scopesAt("TODO", occurrence)).toContain("storage.type.class.todo");
    }
    expect(scopesAt("TODO", 0)).toContain("comment.line.cs");
    expect(scopesAt("TODO", 1)).toContain("comment.block.cs");
    expect(scopesAt("TODO", 2)).not.toContain("storage.type.class.todo");
    for (const url of [
      "https://example.com/line",
      "https://example.com/block",
      "https://example.com/string",
    ]) {
      expect(scopesAt(url)).toContain("markup.underline.link.hyperlink");
    }
    expect(scopesAt("https://example.com/string")).toContain("string.quoted.double.cs");
  });

  it("does not create annotation layers for content rejected by the target grammars", async () => {
    await setUp(
      [
        "// ordinary comment",
        "/* todo: lowercase; TODOS are ordinary prose */",
        "// nothttps://example.com and ftp://example.com",
        'var plain = "ordinary string";',
        'var todo = "TODO only in a string";',
      ].join("\n"),
    );

    await expectAnnotations([]);
    expect(scopesAt("ordinary comment")).toContain("comment.line.cs");
    expect(scopesAt("ordinary string")).toContain("string.quoted.double.cs");
    expect(scopesAt("TODO")).not.toContain("storage.type.class.todo");
  });

  for (const [packageName, scopeName, token, tokenScope, remainingScope] of [
    ["language-todo", "text.todo", "TODO", "storage.type.class.todo", "text.hyperlink"],
    [
      "language-hyperlink",
      "text.hyperlink",
      "https://example.com/lifecycle",
      "markup.underline.link.hyperlink",
      "text.todo",
    ],
  ]) {
    it(`removes and restores annotations when ${packageName} is reactivated`, async () => {
      await setUp("// TODO https://example.com/lifecycle");
      await expectAnnotations(["text.todo", "text.hyperlink"]);

      await lumine.packages.deactivatePackage(packageName);
      expect(lumine.grammars.grammarForScopeName(scopeName)).toBeUndefined();
      expect(await editor.whenGrammarSettled()).toBe(true);
      await expectAnnotations([remainingScope]);
      expect(scopesAt(token)).not.toContain(tokenScope);

      await lumine.packages.activatePackage(packageName);
      expect(await editor.whenGrammarSettled()).toBe(true);
      await expectAnnotations(["text.todo", "text.hyperlink"]);
      expect(scopesAt(token)).toContain(tokenScope);
    });
  }

  it("restores annotations without duplicates when C# is reactivated", async () => {
    await setUp("// TODO https://example.com/lifecycle");
    await expectAnnotations(["text.todo", "text.hyperlink"]);

    await lumine.packages.deactivatePackage("language-csharp");
    expect(lumine.grammars.grammarForScopeName("source.cs")).toBeUndefined();
    expect(editor.getGrammar().scopeName).not.toBe("source.cs");
    await expectAnnotations([]);

    await lumine.packages.activatePackage("language-csharp");
    expect(await editor.whenGrammarSettled()).toBe(true);
    expect(editor.getGrammar()).toBe(lumine.grammars.grammarForScopeName("source.cs"));
    await expectAnnotations(["text.todo", "text.hyperlink"]);
    expect(scopesAt("TODO")).toContain("storage.type.class.todo");
    expect(scopesAt("https://example.com/lifecycle")).toContain("markup.underline.link.hyperlink");
  });
});
