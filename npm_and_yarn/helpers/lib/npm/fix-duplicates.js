const semver = require("semver");

module.exports = (packageObject, lockObject, updatedDependencyName) => {
  if (!updatedDependencyName) {
    throw new Error("Npm fix duplicates: must provide dependency name");
  }

  const deps = [];
  ["dependencies", "devDependencies", "optionalDependencies"].forEach(type => {
    Object.entries(packageObject[type] || {}).map(([name, requirement]) => {
      if (requirement === "") {
        requirement = "*";
      }
      deps.push({ name, requirement, type });
    });
  });

  function findVersions(obj, depName) {
    return Object.entries(obj.dependencies).reduce((acc, [name, entry]) => {
      if (name === depName) {
        acc.push(entry.version);
      }
      if (entry.dependencies) {
        acc = acc.concat(findVersions(entry, depName));
      }
      return acc;
    }, []);
  }

  function findSubDependencies(obj, depName) {
    return Object.entries(obj.dependencies).reduce((acc, [name, entry]) => {
      if (name === depName && entry.dependencies) {
        acc = acc.concat(Object.keys(entry.dependencies));
      }
      if (entry.dependencies) {
        acc = acc.concat(findSubDependencies(entry, depName));
      }
      return acc;
    }, []);
  }

  const versions = findVersions(lockObject, updatedDependencyName);
  const subDeps = findSubDependencies(lockObject, updatedDependencyName);

  console.log(deps);
  console.log(versions);
  console.log(subDeps);

  // find all versions of updated dep name
  // find all sub deps of updated dep
  // start with latest updated dep version and try to move it up one level
  //    find parent requirement and check if current version is satisfied
  //

  // what to dedupe = find all versions of updated dependency and all of their
  // requirements
  //
  // what is going on?
  // if top level requirement?
  // - find max version that satisfies the requirement and set as top level
  //   version
  // if top level and sub?
  // if only multiple sub deps?

  // package.json
  //   depB@^0.2.8
  //
  // depA
  //   v: 1
  //   depB@^0.2
  // depB
  //   v: 0.2.9
  // depC
  //   v 2
  //   depB@^1.0
  //     v: 1.2
  // depD
  //   v 2
  //   depB@^1.1
  //     v: 1.1.2

  // package might have requirements top level which only exist in package.json
  // scan package.json and create a an entry for each package with requirements
  // array
  // add requirement from package.json as first entry for each package
  // { name: "lodash",
  //   versions: [
  //     {  }
  //   ],
  //   requirements: [
  //   {
  //     parent: null,
  //     requirement: "~1.2",
  //     file: "package.json"
  //   }
  // ]}

  return {};
};
