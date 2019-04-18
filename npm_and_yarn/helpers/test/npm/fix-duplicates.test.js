const path = require("path");
const os = require("os");
const fs = require("fs");
const dedupe = require("../../lib/npm/fix-duplicates");
const helpers = require("./helpers");
const npm = require("npm");
const rimraf = require("rimraf");
const install = require("npm/lib/install");

const runDeduper = async directory => {
  await helpers.runAsync(npm, npm.load, [
    {
      loglevel: "silent",
      force: true,
      audit: false,
      "prefer-offline": true,
      "ignore-scripts": true
    }
  ]);

  const dryRun = true;
  const deduper = new dedupe.Deduper(directory, dryRun, {
    packageLockOnly: true
  });

  await helpers.runAsync(deduper, deduper.run, []);

  const cleanupInstaller = new install.Installer(directory, dryRun, [], {
    packageLockOnly: true
  });

  await helpers.runAsync(cleanupInstaller, cleanupInstaller.run, []);
};

const setupTests = (targetDir, testDirName) => {
  const srcLockfile = path.join(
    __dirname,
    `fixtures/fix-duplicates/${testDirName}/package-lock.json`
  );
  fs.copyFileSync(srcLockfile, `${targetDir}/package-lock.json`);

  const srcPackageJson = path.join(
    __dirname,
    `fixtures/fix-duplicates/${testDirName}/package.json`
  );
  fs.copyFileSync(srcPackageJson, `${targetDir}/package.json`);
};

const readFile = (dir, file) => {
  return fs.readFileSync(path.join(dir, file)).toString();
};

describe("deduper", () => {
  let tempDir;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(`${os.tmpdir()}${path.sep}`);
  });
  afterEach(() => {
    rimraf.sync(tempDir);
  });

  it("fixes nested duplicates", async () => {
    setupTests(tempDir, "nested-duplicate");
    await runDeduper(tempDir);

    const dedupedFixture = helpers.loadFixture(
      "fix-duplicates/nested-duplicate/fixed-package-lock.json"
    );

    const lockfile = fs
      .readFileSync(path.join(tempDir, "package-lock.json"))
      .toString();

    expect(lockfile).toEqual(dedupedFixture);
  });

  it("fixes top level duplicates", async () => {
    setupTests(tempDir, "top-level-duplicate");
    await runDeduper(tempDir);

    const dedupedFixture = helpers.loadFixture(
      "fix-duplicates/top-level-duplicate/fixed-package-lock.json"
    );

    const lockfile = fs
      .readFileSync(path.join(tempDir, "package-lock.json"))
      .toString();

    expect(lockfile).toEqual(dedupedFixture);
  });

  it("fixes multiple duplicates", async () => {
    setupTests(tempDir, "multiple-duplicate");
    await runDeduper(tempDir);

    const dedupedFixture = helpers.loadFixture(
      "fix-duplicates/multiple-duplicate/fixed-package-lock.json"
    );

    const lockfile = fs
      .readFileSync(path.join(tempDir, "package-lock.json"))
      .toString();

    expect(lockfile).toEqual(dedupedFixture);
  });
});
