const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");

function writeStartupLog(message) {
  const logPath = process.env.CAIRN_ELECTRON_STARTUP_LOG;
  if (!logPath) {
    return;
  }

  const line = `${new Date().toISOString()} ${message}\n`;
  try {
    fs.appendFileSync(logPath, line);
  } catch (error) {
    console.error(`[cairn-electron] failed to write startup log: ${error.message}`);
  }
}

function normalizeServerUrl(url) {
  return url.replace(/\/+$/, "");
}

function getBackendExecutablePath(resourcesPath, platform = process.platform) {
  const executable = platform === "win32" ? "cairn-server.exe" : "cairn-server";
  return path.join(resourcesPath, "backend", executable);
}

function buildPythonServerCommand({
  isPackaged,
  platform = process.platform,
  resourcesPath,
  projectRoot,
  host,
  port,
  dbPath,
}) {
  const serveArgs = [
    "serve",
    "--host",
    host,
    "--port",
    String(port),
    "--db-path",
    dbPath,
    "--no-access-log",
  ];

  if (isPackaged) {
    return {
      command: getBackendExecutablePath(resourcesPath, platform),
      args: serveArgs,
      cwd: resourcesPath,
    };
  }

  return {
    command: "uv",
    args: ["run", "--project", path.join(projectRoot, "cairn"), "cairn", ...serveArgs],
    cwd: projectRoot,
  };
}

function findFreePort(host = "127.0.0.1") {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(`${url}/openapi.json`, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) {
          resolve();
          return;
        }
        retry();
      });

      request.on("error", retry);
      request.setTimeout(1500, () => {
        request.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error(`Cairn server did not become ready within ${timeoutMs}ms`));
        return;
      }
      setTimeout(check, 250);
    };

    check();
  });
}

async function startCairnServer({ app, projectRoot }) {
  if (process.env.CAIRN_SERVER_URL) {
    return {
      url: normalizeServerUrl(process.env.CAIRN_SERVER_URL),
      process: null,
      stop: async () => {},
    };
  }

  const host = "127.0.0.1";
  const port = await findFreePort(host);
  const userData = app.getPath("userData");
  fs.mkdirSync(userData, { recursive: true });

  const command = buildPythonServerCommand({
    isPackaged: app.isPackaged,
    platform: process.platform,
    resourcesPath: process.resourcesPath,
    projectRoot,
    host,
    port,
    dbPath: path.join(userData, "cairn.db"),
  });

  writeStartupLog(`app.isPackaged=${app.isPackaged}`);
  writeStartupLog(`resourcesPath=${process.resourcesPath}`);
  writeStartupLog(`userData=${userData}`);
  writeStartupLog(`backend command=${command.command}`);
  writeStartupLog(`backend cwd=${command.cwd}`);
  writeStartupLog(`backend args=${JSON.stringify(command.args)}`);

  if (app.isPackaged && !fs.existsSync(command.command)) {
    throw new Error(`Packaged Cairn backend executable is missing: ${command.command}`);
  }

  const child = spawn(command.command, command.args, {
    cwd: command.cwd,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    env: {
      ...process.env,
      CAIRN_DESKTOP: "1",
    },
  });

  child.on("error", (error) => {
    writeStartupLog(`backend spawn error=${error.message}`);
    console.error(`[cairn-server] spawn error: ${error.message}`);
  });
  child.on("exit", (code, signal) => {
    writeStartupLog(`backend exited code=${code} signal=${signal}`);
  });
  child.stdout.on("data", (chunk) => console.log(`[cairn-server] ${chunk}`.trimEnd()));
  child.stderr.on("data", (chunk) => console.error(`[cairn-server] ${chunk}`.trimEnd()));

  const url = `http://${host}:${port}`;
  writeStartupLog(`waiting for backend url=${url}`);
  await waitForServer(url);
  writeStartupLog(`backend ready url=${url}`);

  return {
    url,
    process: child,
    stop: async () => {
      if (child.killed) {
        return;
      }
      child.kill();
    },
  };
}

module.exports = {
  buildPythonServerCommand,
  findFreePort,
  getBackendExecutablePath,
  normalizeServerUrl,
  startCairnServer,
  waitForServer,
};
