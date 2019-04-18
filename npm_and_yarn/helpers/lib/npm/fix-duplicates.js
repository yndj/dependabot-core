// This is currently a copy-paste of
// https://github.com/npm/cli/blob/latest/lib/dedupe.js with
// `Deduper.prototype.loadIdealTree` removed falling back to the Installer
// method (this was causing the lockfile to be emptied when running in dry-run
// mode).

var util = require("util");
var validate = require("aproba");
var without = require("lodash.without");
var asyncMap = require("slide").asyncMap;
var chain = require("slide").chain;
var npa = require("npm-package-arg");
var log = require("npmlog");
var semver = require("semver");

var Installer = require("npm/lib/install").Installer;
var findRequirement = require("npm/lib/install/deps").findRequirement;
var earliestInstallable = require("npm/lib/install/deps").earliestInstallable;
var checkPermissions = require("npm/lib/install/check-permissions");
var decomposeActions = require("npm/lib/install/decompose-actions");
var computeMetadata = require("npm/lib/install/deps").computeMetadata;
var sortActions = require("npm/lib/install/diff-trees").sortActions;
var moduleName = require("npm/lib/utils/module-name");
var packageId = require("npm/lib/utils/package-id");
var childPath = require("npm/lib/utils/child-path");
var getRequested = require("npm/lib/install/get-requested");

module.exports.Deduper = Deduper;

function Deduper(where, dryrun, opts) {
  validate("SBO", arguments);
  Installer.call(this, where, dryrun, [], opts);
  this.noPackageJsonOk = true;
  this.topLevelLifecycles = false;
}
util.inherits(Deduper, Installer);

function andComputeMetadata(tree) {
  return function(next) {
    next(null, computeMetadata(tree));
  };
}

Deduper.prototype.generateActionsToTake = function(cb) {
  validate("F", arguments);
  log.silly("dedupe", "generateActionsToTake");
  chain(
    [
      [this.newTracker(log, "hoist", 1)],
      [hoistChildren, this.idealTree, this.differences],
      [this, this.finishTracker, "hoist"],
      [this.newTracker(log, "sort-actions", 1)],
      [
        this,
        function(next) {
          this.differences = sortActions(this.differences);
          next();
        }
      ],
      [this, this.finishTracker, "sort-actions"],
      [checkPermissions, this.differences],
      [decomposeActions, this.differences, this.todo]
    ],
    cb
  );
};

function move(node, hoistTo, diff) {
  node.parent.children = without(node.parent.children, node);
  hoistTo.children.push(node);
  node.fromPath = node.path;
  node.path = childPath(hoistTo.path, node);
  node.parent = hoistTo;
  if (
    !diff.filter(function(action) {
      return action[0] === "move" && action[1] === node;
    }).length
  ) {
    diff.push(["move", node]);
  }
}

function moveRemainingChildren(node, diff) {
  node.children.forEach(function(child) {
    move(child, node, diff);
    moveRemainingChildren(child, diff);
  });
}

function remove(child, diff, done) {
  remove_(child, diff, new Set(), done);
}

function remove_(child, diff, seen, done) {
  if (seen.has(child)) return done();
  seen.add(child);
  diff.push(["remove", child]);
  child.parent.children = without(child.parent.children, child);
  asyncMap(
    child.children,
    function(child, next) {
      remove_(child, diff, seen, next);
    },
    done
  );
}

function hoistChildren(tree, diff, next) {
  hoistChildren_(tree, diff, new Set(), next);
}

function hoistChildren_(tree, diff, seen, next) {
  validate("OAOF", arguments);
  if (seen.has(tree)) return next();
  seen.add(tree);
  asyncMap(
    tree.children,
    function(child, done) {
      if (!tree.parent || child.fromBundle || child.package._inBundle)
        return hoistChildren_(child, diff, seen, done);
      var better = findRequirement(
        tree.parent,
        moduleName(child),
        getRequested(child) || npa(packageId(child))
      );
      // add semver.gt check
      if (better && semver.gt(better.package.version, child.package.version)) {
        return chain([[remove, child, diff], [andComputeMetadata(tree)]], done);
      }

      // NOTE CHANGE: change second argument from `tree.parent` to `tree`
      var hoistTo = earliestInstallable(tree, tree, child.package, log);
      if (hoistTo) {
        // NOTE CHANGE: change second argument from `hoistTo` to
        // `hoistTo.parent || hoistTo`
        move(child, hoistTo.parent || hoistTo, diff);
        chain(
          [
            [andComputeMetadata(hoistTo)],
            [hoistChildren_, child, diff, seen],
            [
              function(next) {
                moveRemainingChildren(child, diff);
                next();
              }
            ]
          ],
          done
        );
      } else {
        done();
      }
    },
    next
  );
}
