const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const {
  buildPythonServerCommand,
  getBackendExecutablePath,
  normalizeServerUrl,
} = require("../server-process");

test("normalizeServerUrl trims trailing slashes", () => {
  assert.equal(normalizeServerUrl("http://127.0.0.1:8000///"), "http://127.0.0.1:8000");
});

test("getBackendExecutablePath resolves packaged platform executable", () => {
  const resourcesPath = path.join("Applications", "Cairn.app", "Contents", "Resources");

  assert.equal(
    getBackendExecutablePath(resourcesPath, "win32"),
    path.join(resourcesPath, "backend", "cairn-server.exe"),
  );
  assert.equal(
    getBackendExecutablePath(resourcesPath, "darwin"),
    path.join(resourcesPath, "backend", "cairn-server"),
  );
});

test("buildPythonServerCommand prefers bundled backend when packaged", () => {
  const resourcesPath = path.join("Applications", "Cairn.app", "Contents", "Resources");
  const dbPath = path.join("Users", "me", "Library", "Application Support", "Cairn", "cairn.db");
  const command = buildPythonServerCommand({
    isPackaged: true,
    platform: "darwin",
    resourcesPath,
    projectRoot: "/repo",
    host: "127.0.0.1",
    port: 49152,
    dbPath,
  });

  assert.equal(command.command, path.join(resourcesPath, "backend", "cairn-server"));
  assert.deepEqual(command.args, [
    "serve",
    "--host",
    "127.0.0.1",
    "--port",
    "49152",
    "--db-path",
    dbPath,
    "--no-access-log",
  ]);
  assert.equal(command.cwd, resourcesPath);
});

test("buildPythonServerCommand uses uv project in development", () => {
  const command = buildPythonServerCommand({
    isPackaged: false,
    platform: "linux",
    resourcesPath: "/tmp/resources",
    projectRoot: "/repo",
    host: "127.0.0.1",
    port: 49153,
    dbPath: "/tmp/cairn.db",
  });

  assert.equal(command.command, "uv");
  assert.deepEqual(command.args, [
    "run",
    "--project",
    path.join("/repo", "cairn"),
    "cairn",
    "serve",
    "--host",
    "127.0.0.1",
    "--port",
    "49153",
    "--db-path",
    "/tmp/cairn.db",
    "--no-access-log",
  ]);
  assert.equal(command.cwd, "/repo");
});
