const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const url = require('node:url');
const { execSync } = require('node:child_process');

// Settings file path
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

// Load settings
function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    }
  } catch (e) { console.error('Error loading settings:', e); }
  return {};
}

// Save settings
function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (e) { console.error('Error saving settings:', e); }
}

// Helper to extract text from CapCut material content
function extractTextFromContent(content) {
  if (!content) return '';
  // If it's a simple string, return it
  if (typeof content === 'string') {
    // Try to parse as JSON (CapCut stores text content as JSON)
    try {
      const parsed = JSON.parse(content);
      // CapCut text format: {"text": "actual text"} or nested structures
      if (parsed.text) return parsed.text;
      // Sometimes it's in styles array
      if (parsed.styles && Array.isArray(parsed.styles)) {
        // Look for text in various places
        for (const style of parsed.styles) {
          if (style.text) return style.text;
        }
      }
      // Return empty if it's just style data with no text
      return '';
    } catch {
      // Not JSON, return as is (might be plain text)
      return content.substring(0, 50);
    }
  }
  return '';
}

// Helper para executar o script Python
function runPython(command) {
  // Em dev, __dirname aponta para .webpack/main, então usamos process.cwd()
  // Em produção, usamos app.getAppPath() que aponta para o .asar/pasta do app
  const basePath = app.isPackaged
    ? path.dirname(app.getPath('exe'))
    : process.cwd();

  const pythonScript = path.join(basePath, 'python', 'sync_engine.py');
  const cmdJson = JSON.stringify(command);

  console.log('[Python] Script path:', pythonScript);
  console.log('[Python] Command:', command.action);

  try {
    const result = execSync(`python "${pythonScript}" "${cmdJson.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024 // 50MB
    });
    return JSON.parse(result);
  } catch (error) {
    console.error('[Python] Error:', error.message);
    return { error: error.message };
  }
}

if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0A0A0A',
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false, // Disable for dev - allows Firebase auth
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// IPC Handlers
ipcMain.handle('select-folder', async () => {
  if (!mainWindow) return null;
  const settings = loadSettings();
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Selecione a pasta do projeto CapCut',
    defaultPath: settings.lastProjectPath || undefined,
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const folderPath = result.filePaths[0];
  const draftContentPath = path.join(folderPath, 'draft_content.json');
  if (!fs.existsSync(draftContentPath)) {
    return { error: 'Arquivo draft_content.json não encontrado!' };
  }
  // Save last path
  saveSettings({ ...settings, lastProjectPath: path.dirname(folderPath) });
  return { path: folderPath, name: path.basename(folderPath), draftPath: draftContentPath };
});

ipcMain.handle('analyze-project', async (_, draftPath) => {
  try {
    const content = fs.readFileSync(draftPath, 'utf-8');
    const project = JSON.parse(content);
    const tracks = project.tracks || [];
    const materials = project.materials || {};

    // Build a map of material IDs to content/names
    const materialMap = {};
    for (const [, matList] of Object.entries(materials)) {
      if (Array.isArray(matList)) {
        matList.forEach(mat => {
          if (mat.id) {
            // Extract actual text from content field
            const textContent = extractTextFromContent(mat.content);
            materialMap[mat.id] = {
              name: mat.name || mat.path || '',
              text: textContent,
            };
          }
        });
      }
    }

    const trackInfos = tracks.map((track, index) => {
      const segments = track.segments || [];
      const duration = segments.reduce((sum, seg) => sum + (seg.target_timerange?.duration || 0), 0);

      // Enrich segments with material info (text content, names)
      const enrichedSegments = segments.map(seg => {
        const mat = materialMap[seg.material_id] || {};
        const materialName = mat.name ? path.basename(mat.name) : '';
        return {
          ...seg,
          text: mat.text || '',
          materialName: materialName
        };
      });

      // Get track name from first segment - prefer materialName for audio/video, text for subtitles
      let name = '';
      if (enrichedSegments.length > 0) {
        const firstSeg = enrichedSegments[0];
        if (['text', 'subtitle'].includes(track.type)) {
          // For text/subtitle tracks, show the actual text
          name = firstSeg.text || firstSeg.materialName || 'Texto';
        } else {
          // For other tracks, show material name
          name = firstSeg.materialName || firstSeg.text || '';
        }
      }

      return {
        index,
        type: track.type,
        segments: segments.length,
        duration,
        durationSec: duration / 1000000,
        name,
        segmentsData: enrichedSegments
      };
    });
    return { tracks: trackInfos };
  } catch (error) { return { error: 'Erro: ' + error }; }
});

// ============ SELECT SRT FOLDER ============
ipcMain.handle('select-srt-folder', async () => {
  if (!mainWindow) return null;
  const settings = loadSettings();
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Selecione a pasta com arquivos .srt',
    defaultPath: settings.lastSrtPath || undefined,
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const folderPath = result.filePaths[0];
  // Count .srt files
  const files = fs.readdirSync(folderPath);
  const srtFiles = files.filter(f => f.toLowerCase().endsWith('.srt'));
  if (srtFiles.length === 0) {
    return { error: 'Nenhum arquivo .srt encontrado na pasta!' };
  }
  // Save last SRT path
  saveSettings({ ...settings, lastSrtPath: folderPath });
  return { path: folderPath, name: path.basename(folderPath), srtCount: srtFiles.length };
});

ipcMain.handle('window-minimize', () => mainWindow?.minimize());
ipcMain.handle('window-maximize', () => { if (mainWindow?.isMaximized()) mainWindow.unmaximize(); else mainWindow?.maximize(); });
ipcMain.handle('window-close', () => mainWindow?.close());
ipcMain.handle('open-external', async (_, url) => await shell.openExternal(url));

// ============ SYNC PROJECT (via Python) ============
ipcMain.handle('sync-project', async (_, { draftPath, audioTrackIndex, mode, syncSubtitles, applyAnimations }) => {
  return runPython({ action: 'sync', draftPath, audioTrackIndex, mode: mode || 'audio', syncSubtitles, applyAnimations });
});

// ============ LOOP VIDEO (via Python) ============
ipcMain.handle('loop-video', async (_, { draftPath, audioTrackIndex, order }) => {
  return runPython({ action: 'loop_video', draftPath, audioTrackIndex, order: order || 'random' });
});

// ============ LOOP AUDIO (via Python) ============
ipcMain.handle('loop-audio', async (_, { draftPath, trackIndex, targetDuration }) => {
  return runPython({ action: 'loop_audio', draftPath, trackIndex, targetDuration });
});

// ============ INSERT SRT (via Python) ============
ipcMain.handle('insert-srt', async (_, { draftPath, srtFolder, createTitle }) => {
  return runPython({ action: 'insert_srt', draftPath, srtFolder, createTitle });
});

// Google OAuth via browser
const GOOGLE_CLIENT_ID = '943297790089-YOUR_CLIENT_ID.apps.googleusercontent.com'; // Will be updated
const OAUTH_PORT = 8847;

ipcMain.handle('google-oauth-browser', async () => {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url, true);

      // Handle the callback
      if (parsedUrl.pathname === '/callback') {
        // Send success page to browser
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html>
            <head><title>Login Concluído</title></head>
            <body style="font-family: Arial; text-align: center; padding: 50px; background: #0A0A0A; color: white;">
              <h1 style="color: #E85A2A;">✓ Login realizado com sucesso!</h1>
              <p>Você pode fechar esta janela e voltar ao aplicativo.</p>
              <script>setTimeout(() => window.close(), 2000);</script>
            </body>
          </html>
        `);

        server.close();

        // Extract tokens from query params (converted from hash by landing page)
        const accessToken = parsedUrl.query.access_token;
        const idToken = parsedUrl.query.id_token;

        if (accessToken) {
          console.log('OAuth success - token received');
          resolve({ accessToken, idToken });
        } else {
          console.log('OAuth failed - no token in query:', parsedUrl.query);
          reject(new Error('No tokens received'));
        }

        // Focus back on main window
        if (mainWindow) {
          mainWindow.focus();
        }
      } else {
        // Landing page - captures hash and converts to query params
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body>
              <script>
                // Hash fragment is not sent to server, so convert to query params
                if (window.location.hash) {
                  window.location.href = '/callback?' + window.location.hash.substring(1);
                } else if (window.location.search) {
                  window.location.href = '/callback' + window.location.search;
                }
              </script>
            </body>
          </html>
        `);
      }
    });

    server.listen(OAUTH_PORT, '127.0.0.1', () => {
      // Open Google OAuth in browser
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=943297790089-oodptskjakdv439go4ls5q0issmguakd.apps.googleusercontent.com&` +
        `redirect_uri=http://127.0.0.1:${OAUTH_PORT}&` +
        `response_type=token&` +
        `scope=email%20profile%20openid`;

      shell.openExternal(authUrl);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('OAuth timeout'));
    }, 300000);
  });
});

app.whenReady().then(() => {
  // Remove CSP headers from dev server to allow Firebase auth
  const { session } = require('electron');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    delete headers['content-security-policy'];
    delete headers['Content-Security-Policy'];
    callback({ responseHeaders: headers });
  });

  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

console.log('CapCut Sync Pro - Main Process Started');
