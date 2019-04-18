const fs = require("fs");
const path = require("path");
const os = require("os");
const npm = require("npm");
const installer = require("npm/lib/install");

const { muteStderr, runAsync } = require("./helpers.js");
const dedupe = require("./fix-duplicates.js");

// Installs exact version and returns lockfile entry
async function getLockfileEntryForUpdate(depName, depVersion) {
  const directory = fs.mkdtempSync(`${os.tmpdir()}${path.sep}`);
  const readFile = fileName =>
    fs.readFileSync(path.join(directory, fileName)).toString();

  const dryRun = true;
  const arg = [`${depName}@${depVersion}`];
  const install = new installer.Installer(directory, dryRun, arg, {
    packageLockOnly: true
  });
  install.printInstalled = cb => cb();

  const unmute = muteStderr();
  try {
    await runAsync(install, install.run, []);
  } finally {
    unmute();
  }

  const lockfileObject = readFile("package-lock.json");
  const { dependencies } = JSON.parse(lockfileObject);
  const depEntry = dependencies[depName];
  delete dependencies[depName];
  if (Object.keys(dependencies).length) {
    depEntry.dependencies = dependencies;
  }
  return depEntry;
}

// TODO: Support not finding a previous version
function replaceLockfileEntry(lockfile, depName, previousVersion, entry) {
  if (!lockfile.dependencies) return lockfile;
  const dependencies = Object.keys(lockfile.dependencies).reduce(
    (acc, name) => {
      let value = lockfile.dependencies[name];
      if (name === depName && value.version === previousVersion) {
        value = entry;
      } else if (value.dependencies) {
        value = replaceLockfileEntry(value, depName, previousVersion, entry);
      }
      acc[name] = value;
      return acc;
    },
    {}
  );
  return {
    ...lockfile,
    dependencies
  };
}

async function updateDependencyFile(
  directory,
  lockfileName,
  updatedDependency
) {
  const readFile = fileName =>
    fs.readFileSync(path.join(directory, fileName)).toString();
  const depName = updatedDependency && updatedDependency.name;
  const depVersion = updatedDependency && updatedDependency.version;

  // `force: true` ignores checks for platform (os, cpu) and engines
  // in npm/lib/install/validate-args.js
  // Platform is checked and raised from (EBADPLATFORM):
  // https://github.com/npm/npm-install-checks
  //
  // `'prefer-offline': true` sets fetch() cache key to `force-cache`
  // https://github.com/npm/npm-registry-fetch
  //
  // `'ignore-scripts': true` used to disable prepare and prepack scripts
  // which are run when installing git dependencies
  await runAsync(npm, npm.load, [
    {
      loglevel: "silent",
      force: true,
      audit: false,
      "prefer-offline": true,
      "ignore-scripts": true
    }
  ]);

  // SubDependencyVersionResolver relies on the install finding the latest
  // version of a sub-dependency that's been removed from the lockfile
  // NpmLockFileUpdater passes a specific version to be updated
  if (depName && depVersion) {
    const lockfileEntryForUpdate = await getLockfileEntryForUpdate(
      depName,
      depVersion
    );
    const previousVersion =
      updatedDependency && updatedDependency.previous_version;
    const originalNpmLock = readFile(lockfileName);
    const mergedLockfile = replaceLockfileEntry(
      JSON.parse(originalNpmLock),
      depName,
      previousVersion,
      lockfileEntryForUpdate
    );

    fs.writeFileSync(
      path.join(directory, lockfileName),
      JSON.stringify(mergedLockfile, null, 2)
    );

    // const dryRun = true;
    // const deduper = new dedupe.Deduper(directory, dryRun, {
    //   packageLockOnly: true
    // });
    // deduper.printInstalled = cb => cb();

    // const unmute = muteStderr();
    // try {
    //   await runAsync(deduper, deduper.run, []);
    // } finally {
    //   unmute();
    // }
  }

  const dryRun = true;
  const initialInstaller = new installer.Installer(directory, dryRun, [], {
    packageLockOnly: true
  });

  // Skip printing the success message
  initialInstaller.printInstalled = cb => cb();

  // There are some hard-to-prevent bits of output.
  // This is horrible, but works.
  const unmute = muteStderr();
  try {
    // await runAsync(initialInstaller, initialInstaller.run, []);
  } finally {
    unmute();
  }

  const updatedLockfile = readFile(lockfileName);

  return { [lockfileName]: updatedLockfile };
}

module.exports = { updateDependencyFile };
