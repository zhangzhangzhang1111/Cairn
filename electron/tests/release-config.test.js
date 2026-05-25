const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "..", "..");
const packageJson = require(path.join(projectRoot, "package.json"));

test("electron release metadata identifies the app publisher", () => {
  assert.equal(packageJson.author, "leixiao <1729888211@qq.com>");
});

test("macOS release config uses custom icon, signing entitlements, hardened runtime, and notarization", () => {
  const mac = packageJson.build.mac;
  const iconPath = path.join(projectRoot, mac.icon);
  const entitlementsPath = path.join(projectRoot, mac.entitlements);
  const inheritedEntitlementsPath = path.join(projectRoot, mac.entitlementsInherit);

  assert.equal(packageJson.build.icon, "build/icon");
  assert.equal(mac.icon, "build/icon.icns");
  assert.equal(mac.hardenedRuntime, true);
  assert.equal(mac.gatekeeperAssess, false);
  assert.equal(mac.notarize, true);
  assert.equal(mac.entitlements, "build/entitlements.mac.plist");
  assert.equal(mac.entitlementsInherit, "build/entitlements.mac.inherit.plist");

  assert.ok(fs.existsSync(iconPath), "macOS icon file must exist");
  assert.ok(fs.statSync(iconPath).size > 0, "macOS icon file must not be empty");
  assert.ok(fs.existsSync(entitlementsPath), "macOS entitlements file must exist");
  assert.ok(fs.existsSync(inheritedEntitlementsPath), "macOS inherited entitlements file must exist");
});

test("Windows NSIS installer supports deterministic silent install directory", () => {
  assert.equal(packageJson.build.artifactName, "${productName}-Setup-${version}.${ext}");
  assert.deepEqual(packageJson.build.win.target, ["nsis"]);
  assert.equal(packageJson.build.nsis.oneClick, false);
  assert.equal(packageJson.build.nsis.perMachine, false);
  assert.equal(packageJson.build.nsis.allowElevation, false);
  assert.equal(packageJson.build.nsis.allowToChangeInstallationDirectory, true);
});
