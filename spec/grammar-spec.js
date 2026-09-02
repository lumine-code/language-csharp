describe("C# grammar selection", () => {
  beforeEach(async () => {
    await lumine.packages.activatePackage("language-csharp");
  });

  for (const fileName of ["Program.cs", "build.cake", "script.csx"]) {
    it(`uses the C# Tree-sitter grammar for ${fileName}`, () => {
      const grammar = lumine.grammars.selectGrammar(fileName, "");
      expect(grammar.scopeName).toBe("source.cs");
      expect(grammar.type).toBe("tree-sitter");
    });
  }
});
