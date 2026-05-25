const path = require("node:path");
const { app, BrowserWindow, shell } = require("electron");
const { startCairnServer } = require("./server-process");

let mainWindow;
let serverHandle;

function createWindow(serverUrl) {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: "Cairn",
    backgroundColor: "#f8fafc",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadURL(serverUrl);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(serverUrl)) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(serverUrl)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

async function start() {
  const projectRoot = path.resolve(__dirname, "..");
  serverHandle = await startCairnServer({ app, projectRoot });
  createWindow(serverHandle.url);
}

app.whenReady().then(start);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && serverHandle) {
    createWindow(serverHandle.url);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  if (serverHandle) {
    await serverHandle.stop();
    serverHandle = null;
  }
});
