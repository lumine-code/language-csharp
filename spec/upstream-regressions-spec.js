describe("C# upstream parser regressions", () => {
  let editor;

  beforeEach(async () => {
    await lumine.packages.activatePackage("language-csharp");
    editor = await lumine.workspace.open();
    editor.setGrammar(lumine.grammars.grammarForScopeName("source.cs"));
  });

  afterEach(() => editor?.destroy());

  it("parses a parenthesized identifier followed by logical AND without a cast", async () => {
    editor.setText("class C { void M(bool a, bool b) { var c = (a) && b; } }\n");
    expect(await editor.whenGrammarSettled()).toBe(true);
    const root = editor.getSyntaxNodeAtBufferPosition([0, 0], (node) => !node.parent);
    expect(root.hasError).toBe(false);
    expect(root.descendantsOfType("cast_expression").length).toBe(0);
    expect(root.descendantsOfType("binary_expression").length).toBe(1);
  });

  it("parses C# 14 extension declarations", async () => {
    editor.setText(
      "public static class E { extension(string text) { public int Count => text.Length; } }\n",
    );
    expect(await editor.whenGrammarSettled()).toBe(true);
    const root = editor.getSyntaxNodeAtBufferPosition([0, 0], (node) => !node.parent);
    expect(root.hasError).toBe(false);
    expect(root.descendantsOfType("extension_declaration").length).toBe(1);
  });

  it("parses a generic name before equality as the left operand", async () => {
    editor.setText("class C { void M() { var result = F<int> == null; } }\n");
    expect(await editor.whenGrammarSettled()).toBe(true);
    const root = editor.getSyntaxNodeAtBufferPosition([0, 0], (node) => !node.parent);
    expect(root.hasError).toBe(false);
    const [comparison] = root.descendantsOfType("binary_expression");
    expect(comparison.childForFieldName("left").type).toBe("generic_name");
    expect(comparison.childForFieldName("right").type).toBe("null_literal");
  });
});
