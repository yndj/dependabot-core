const path = require("path");
const fs = require("fs");

module.exports.runAsync = (obj, method, args) => {
  return new Promise((resolve, reject) => {
    const cb = (err, ...returnValues) => {
      if (err) {
        reject(err);
      } else {
        resolve(returnValues);
      }
    };
    method.apply(obj, [...args, cb]);
  });
};

module.exports.loadFixture = fixturePath => {
  return fs
    .readFileSync(path.join(__dirname, "fixtures", fixturePath))
    .toString();
};
