const path = require("path");

describe("WASM Tree-sitter C# grammar", () => {
  let editor;

  beforeEach(async () => {
    await lumine.packages.activatePackage("language-csharp");
  });

  afterEach(() => editor?.destroy());

  it("passes grammar tests", async () => {
    await runGrammarTests(path.join(__dirname, "fixtures", "sample.cs"), /\/\//);
  });

  it("scopes raw interpolation delimiters from leaf nodes", async () => {
    editor = await lumine.workspace.open("interpolation.cs");
    const text = 'var value = $$"""before {{name}} after""";';
    editor.setText(text);
    await editor.languageMode.ready;

    const scopesAt = (needle, occurrence = 0) => {
      let index = -1;
      for (let count = 0; count <= occurrence; count++) index = text.indexOf(needle, index + 1);
      return editor
        .scopeDescriptorForBufferPosition(editor.getBuffer().positionForCharacterIndex(index))
        .getScopesArray();
    };

    expect(scopesAt('"""', 0)).toContain("punctuation.definition.string.begin.cs");
    expect(scopesAt('"""', 1)).toContain("punctuation.definition.string.end.cs");
    expect(scopesAt("before")).toContain("string.quoted.triple.interpolated.cs");
    expect(scopesAt("name")).toContain("meta.embedded.line.cs");
    expect(scopesAt("{{")).toContain("punctuation.section.embedded.begin.cs");
    expect(scopesAt("}}")).toContain("punctuation.section.embedded.end.cs");
  });

  it("preserves type and return-field scopes with field-rooted captures", async () => {
    editor = await lumine.workspace.open("types.cs");
    editor.setText("class Example { Generic<Type> Build() => value; }");
    await editor.languageMode.ready;

    expect(editor.scopeDescriptorForBufferPosition([0, 16]).getScopesArray()).toContain(
      "support.storage.type.cs",
    );
    expect(editor.scopeDescriptorForBufferPosition([0, 24]).getScopesArray()).toContain(
      "support.storage.type.cs",
    );
  });
});
