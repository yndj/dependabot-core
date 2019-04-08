const path = require("path");
const os = require("os");
const fs = require("fs");
const fixDuplicates = require("../../lib/npm/fix-duplicates");
const helpers = require("./helpers");

describe("fixDuplicates", () => {
  let tempDir;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(`${os.tmpdir()}${path.sep}`);
  });
  afterEach(() => fs.rmdirSync(tempDir));

  it("fixes duplicates", async () => {
    const packageFixture = helpers.loadFixture("fix-duplicates/package.json");
    const duplicatedFixture = helpers.loadFixture(
      "fix-duplicates/duplicated-package-lock.json"
    );
    const dedupedFixture = helpers.loadFixture(
      "fix-duplicates/deduped-package-lock.json"
    );
    const fixed = fixDuplicates(
      JSON.parse(packageFixture),
      JSON.parse(duplicatedFixture),
      "js-yaml"
    );
    expect(JSON.stringify(fixed, null, 2)).toEqual(dedupedFixture);
  });
});
