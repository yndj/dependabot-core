const path = require("path");
const os = require("os");
const fs = require("fs");
const nock = require("nock");
const rimraf = require("rimraf");
const {
  updateDependencyFiles,
  updateVersionPattern
} = require("../../lib/npm/updater");
const helpers = require("./helpers");

describe("updater", () => {
  let tempDir;
  beforeEach(() => {
    nock.disableNetConnect();
    nock("https://registry.npmjs.org")
      .get("/left-pad")
      .reply(200, helpers.loadFixture("npm-left-pad.json"));
    tempDir = fs.mkdtempSync(os.tmpdir() + path.sep);
  });
  afterEach(() => {
    nock.enableNetConnect();
    rimraf.sync(tempDir);
  });

  async function copyDependencies(sourceDir, destDir) {
    const srcPackageJson = path.join(
      __dirname,
      `fixtures/updater/${sourceDir}/package.json`
    );
    fs.copyFileSync(srcPackageJson, `${destDir}/package.json`);

    const srcLockfile = path.join(
      __dirname,
      `fixtures/updater/${sourceDir}/package-lock.json`
    );
    fs.copyFileSync(srcLockfile, `${destDir}/package-lock.json`);
  }

  it("generates an updated package-lock.json", async () => {
    await copyDependencies("original", tempDir);

    const result = await updateDependencyFiles(
      tempDir,
      [
        {
          name: "left-pad",
          version: "1.1.3",
          requirements: [{ file: "package.json", groups: ["dependencies"] }]
        }
      ],
      "package-lock.json"
    );
    expect(result).toEqual({
      "package-lock.json": helpers.loadFixture(
        "updater/updated/package-lock.json"
      )
    });
  });
});
