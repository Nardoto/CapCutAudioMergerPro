const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const url = require('node:url');
const { execSync, spawn, spawnSync } = require('node:child_process');

// App version
const APP_VERSION = '3.2.0';
const UPDATE_URL = 'https://nardoto.com.br/nardoto-updates/capcut-sync-pro-version.json';

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

// Check if CapCut is running
function isCapCutRunning() {
  try {
    // Use tasklist to check for CapCut process
    const result = execSync('tasklist /FI "IMAGENAME eq CapCut.exe" /NH', {
      encoding: 'utf-8',
      windowsHide: true
    });
    // If CapCut is running, the output will contain "CapCut.exe"
    return result.toLowerCase().includes('capcut.exe');
  } catch (e) {
    console.error('Error checking CapCut process:', e);
    return false;
  }
}

// ============ AUTO-UPDATE SYSTEM ============
function checkForUpdates() {
  return new Promise((resolve) => {
    https.get(UPDATE_URL, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const updateInfo = JSON.parse(data);
          if (updateInfo.version && updateInfo.version !== APP_VERSION) {
            resolve({ hasUpdate: true, version: updateInfo.version, downloadUrl: updateInfo.downloadUrl, changelog: updateInfo.changelog });
          } else {
            resolve({ hasUpdate: false });
          }
        } catch (e) {
          console.error('Error parsing update info:', e);
          resolve({ hasUpdate: false, error: e.message });
        }
      });
    }).on('error', (e) => {
      console.error('Error checking for updates:', e);
      resolve({ hasUpdate: false, error: e.message });
    });
  });
}

function downloadUpdate(downloadUrl, targetPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(targetPath);
    https.get(downloadUrl, (response) => {
      // Handle redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        https.get(response.headers.location, (res) => {
          res.pipe(file);
          file.on('finish', () => { file.close(); resolve(true); });
        }).on('error', reject);
      } else {
        response.pipe(file);
        file.on('finish', () => { file.close(); resolve(true); });
      }
    }).on('error', (err) => {
      fs.unlink(targetPath, () => {});
      reject(err);
    });
  });
}

async function performUpdate(downloadUrl) {
  const tempPath = path.join(app.getPath('temp'), 'CapCutSyncPro_Update.exe');
  try {
    await downloadUpdate(downloadUrl, tempPath);
    // Launch installer and quit app
    spawn(tempPath, ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART'], { detached: true, stdio: 'ignore' });
    app.quit();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
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
  // Em produção, extraResource coloca os arquivos em process.resourcesPath
  const basePath = app.isPackaged
    ? process.resourcesPath
    : process.cwd();

  const pythonScript = path.join(basePath, 'python', 'sync_engine.py');
  const cmdJson = JSON.stringify(command);

  console.log('[Python] Script path:', pythonScript);
  console.log('[Python] Command:', command.action);

  // Python script creates timestamped backups automatically
  // No need for duplicate backup here

  try {
    let args;
    let tempFile = null;

    // Se o comando for muito grande (>7000 chars), usar arquivo temporário
    if (cmdJson.length > 7000) {
      const tempDir = require('os').tmpdir();
      tempFile = path.join(tempDir, `capcut_cmd_${Date.now()}.json`);
      fs.writeFileSync(tempFile, cmdJson, 'utf-8');
      console.log('[Python] Using temp file:', tempFile);
      args = [pythonScript, '--file', tempFile];
    } else {
      args = [pythonScript, cmdJson];
    }

    // Use spawnSync for better control over stdout/stderr
    const result = spawnSync('python', args, {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024 // 50MB
    });

    // Limpar arquivo temporário se usado
    if (tempFile) {
      try { fs.unlinkSync(tempFile); } catch {}
    }

    // Log stderr (debug info) - always, even on success
    if (result.stderr && result.stderr.trim()) {
      console.log('[Python-Debug] ========== SRT DEBUG START ==========');
      result.stderr.split('\n').forEach(line => {
        if (line.trim()) console.log('[Python-Debug]', line);
      });
      console.log('[Python-Debug] ========== SRT DEBUG END ==========');
    }

    // Check for error
    if (result.error) {
      console.error('[Python] Spawn error:', result.error.message);
      return { error: result.error.message };
    }

    if (result.status !== 0) {
      console.error('[Python] Exit code:', result.status);
      // Try to parse stdout anyway
      if (result.stdout) {
        try {
          return JSON.parse(result.stdout);
        } catch {
          return { error: `Python exited with code ${result.status}` };
        }
      }
      return { error: `Python exited with code ${result.status}` };
    }

    // Parse successful output
    return JSON.parse(result.stdout);
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

// Select output folder (generic - for saving files)
ipcMain.handle('select-output-folder', async (event) => {
  try {
    // Get the window from the event or use mainWindow as fallback
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (!win) return null;

    const settings = loadSettings();
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Selecione a pasta de saida',
      defaultPath: settings.lastOutputPath || undefined,
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const folderPath = result.filePaths[0];
    // Save last path
    try {
      saveSettings({ ...settings, lastOutputPath: folderPath });
    } catch (e) {
      // Silently ignore save errors
    }
    return folderPath;
  } catch (error) {
    return null;
  }
});

// Select root folder containing multiple projects (for merge)
ipcMain.handle('select-projects-folder', async () => {
  if (!mainWindow) return { canceled: true };
  const settings = loadSettings();
  const os = require('node:os');
  const defaultPath = path.join(os.homedir(), 'AppData', 'Local', 'CapCut', 'User Data', 'Projects', 'com.lveditor.draft');

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Selecione a pasta raiz dos projetos CapCut',
    defaultPath: settings.mergeProjectsPath || defaultPath,
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const folderPath = result.filePaths[0];

  // Save for next time
  saveSettings({ ...settings, mergeProjectsPath: folderPath });

  return { canceled: false, filePath: folderPath };
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

// ============ SCAN SRT FOLDER & MATCH WITH PROJECT ============
ipcMain.handle('scan-srt-matches', async (_, { srtFolder, draftPath }) => {
  try {
    // Read project to get audio names
    const content = fs.readFileSync(draftPath, 'utf-8');
    const project = JSON.parse(content);
    const audios = project.materials?.audios || [];
    const audioMap = {};
    audios.forEach(a => {
      if (a.name) {
        const baseName = path.basename(a.name, path.extname(a.name));
        audioMap[baseName.toLowerCase()] = { id: a.id, name: a.name, baseName };
      }
    });

    // Scan SRT folder
    const files = fs.readdirSync(srtFolder);
    const srtFiles = files.filter(f => f.toLowerCase().endsWith('.srt'));

    // Match SRTs with audios
    const matches = [];
    const unmatched = [];

    srtFiles.forEach(srtFile => {
      const baseName = path.basename(srtFile, '.srt');
      const match = audioMap[baseName.toLowerCase()];

      // Count lines in SRT (rough estimate of subtitle count)
      const srtPath = path.join(srtFolder, srtFile);
      const srtContent = fs.readFileSync(srtPath, 'utf-8');
      const subtitleCount = (srtContent.match(/^\d+$/gm) || []).length;

      if (match) {
        matches.push({
          srtFile,
          srtPath,
          audioName: match.name,
          baseName,
          subtitleCount,
          matched: true
        });
      } else {
        unmatched.push({
          srtFile,
          srtPath,
          baseName,
          subtitleCount,
          matched: false
        });
      }
    });

    return {
      matches,
      unmatched,
      totalSrt: srtFiles.length,
      totalAudios: audios.length,
      matchedCount: matches.length
    };
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('window-minimize', () => mainWindow?.minimize());
ipcMain.handle('window-maximize', () => { if (mainWindow?.isMaximized()) mainWindow.unmaximize(); else mainWindow?.maximize(); });
ipcMain.handle('window-close', () => mainWindow?.close());
ipcMain.handle('open-external', async (_, url) => await shell.openExternal(url));
ipcMain.handle('open-folder-in-explorer', async (_, folderPath) => await shell.openPath(folderPath));

// ============ FILE UTILS ============
ipcMain.handle('read-file-content', async (_, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    return null;
  } catch (e) {
    console.error('Error reading file:', e);
    return null;
  }
});

ipcMain.handle('list-folder-files', async (_, folderPath) => {
  try {
    if (fs.existsSync(folderPath)) {
      return fs.readdirSync(folderPath);
    }
    return [];
  } catch (e) {
    console.error('Error listing folder:', e);
    return [];
  }
});

// ============ CAPCUT LAUNCHER ============
function findCapCutExe() {
  // Tenta encontrar o CapCut em locais comuns
  const possiblePaths = [
    path.join(app.getPath('appData'), '..', 'Local', 'CapCut', 'CapCut.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'CapCut', 'CapCut.exe'),
    'C:\\Program Files\\CapCut\\CapCut.exe',
    'C:\\Program Files (x86)\\CapCut\\CapCut.exe',
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

ipcMain.handle('open-capcut', async () => {
  const capcutExe = findCapCutExe();

  if (!capcutExe) {
    return { error: 'CapCut não encontrado. Verifique se está instalado.' };
  }

  try {
    spawn(capcutExe, [], { detached: true, stdio: 'ignore' });
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});

// ============ CREATE NEW PROJECT ============
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16).toUpperCase();
  });
}

// Ensure all project files use the same draft_id (fixes CapCut visibility issues)
function ensureConsistentDraftId(projectPath, capCutDrafts) {
  try {
    const draftContentPath = path.join(projectPath, 'draft_content.json');
    const draftInfoPath = path.join(projectPath, 'draft_info.json');
    const draftMetaInfoPath = path.join(projectPath, 'draft_meta_info.json');
    const rootMetaPath = path.join(capCutDrafts, 'root_meta_info.json');

    // Use the ID from draft_content.json as the authoritative ID
    if (!fs.existsSync(draftContentPath)) return;
    const draftContent = JSON.parse(fs.readFileSync(draftContentPath, 'utf-8'));
    const correctId = draftContent.id;
    if (!correctId) return;

    // Fix draft_info.json if needed
    if (fs.existsSync(draftInfoPath)) {
      const draftInfo = JSON.parse(fs.readFileSync(draftInfoPath, 'utf-8'));
      if (draftInfo.draft_id !== correctId) {
        draftInfo.draft_id = correctId;
        fs.writeFileSync(draftInfoPath, JSON.stringify(draftInfo, null, 2));
        console.log('[ID Fix] draft_info.json updated');
      }
    }

    // Fix draft_meta_info.json if needed
    if (fs.existsSync(draftMetaInfoPath)) {
      const draftMetaInfo = JSON.parse(fs.readFileSync(draftMetaInfoPath, 'utf-8'));
      if (draftMetaInfo.draft_id !== correctId) {
        draftMetaInfo.draft_id = correctId;
        fs.writeFileSync(draftMetaInfoPath, JSON.stringify(draftMetaInfo));
        console.log('[ID Fix] draft_meta_info.json updated');
      }
    }

    // Fix root_meta_info.json if needed
    if (fs.existsSync(rootMetaPath)) {
      const rootMeta = JSON.parse(fs.readFileSync(rootMetaPath, 'utf-8'));
      const projectName = path.basename(projectPath);
      const entry = rootMeta.all_draft_store.find(d => d.draft_name === projectName);
      if (entry && entry.draft_id !== correctId) {
        entry.draft_id = correctId;
        fs.writeFileSync(rootMetaPath, JSON.stringify(rootMeta));
        console.log('[ID Fix] root_meta_info.json updated');
      }
    }
  } catch (e) {
    console.error('[ID Fix] Error:', e.message);
  }
}

ipcMain.handle('create-new-project', async () => {
  try {
    const capCutDrafts = path.join(app.getPath('appData'), '..', 'Local', 'CapCut', 'User Data', 'Projects', 'com.lveditor.draft');
    if (!fs.existsSync(capCutDrafts)) {
      return { error: 'Pasta de projetos do CapCut nao encontrada. Abra o CapCut primeiro.' };
    }

    const timestamp = Date.now();
    const microTimestamp = timestamp * 1000 + Math.floor(Math.random() * 1000);

    // Encontrar o proximo numero sequencial (001, 002, etc.)
    const existingFolders = fs.readdirSync(capCutDrafts).filter(f => {
      const fullPath = path.join(capCutDrafts, f);
      return fs.statSync(fullPath).isDirectory() && /^\d{3}$/.test(f);
    });
    const existingNumbers = existingFolders.map(f => parseInt(f, 10));
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    const projectName = String(nextNumber).padStart(3, '0');
    const projectPath = path.join(capCutDrafts, projectName);
    const draftId = generateUUID();

    fs.mkdirSync(projectPath, { recursive: true });

    const draftContent = {
      canvas_config: { height: 1080, width: 1920, ratio: "16:9" },
      color_space: 0,
      config: { adjust_max_index: 0, attachment_info: [], combination_max_index: 0, export_range: null, extract_audio_last_index: 0, lyrics_recognition_id: "", lyrics_sync: false, maintrack_adsorb: true, material_save_mode: 0, original_sound_last_index: 0, record_audio_last_index: 0, sticker_max_index: 0, subtitle_recognition_id: "", subtitle_sync: true, system_font_list: [], video_mute: false, zoom_info_params: null },
      cover: null, create_time: Math.floor(timestamp / 1000), duration: 0, extra_info: null, fps: 30.0,
      free_render_index_mode_on: false, group_container: null, id: draftId, keyframe_graph_list: [],
      keyframes: { adjusts: [], audios: [], effects: [], filters: [], handwrites: [], stickers: [], texts: [], videos: [] },
      last_modified_platform: { app_id: 359289, app_source: "cc", app_version: "4.0.0", device_id: "", hard_disk_id: "", mac_address: "", os: "windows", os_version: "10.0.22631" },
      materials: { ai_translates: [], audios: [], audio_balances: [], audio_effects: [], audio_fades: [], audio_track_indexes: [], beats: [], canvases: [], chromas: [], color_curves: [], digital_humans: [], drafts: [], effects: [], flowers: [], green_screens: [], handwrites: [], hsl: [], images: [], log_color_wheels: [], loudnesses: [], manual_deformations: [], masks: [], material_animations: [], material_colors: [], multi_language_refs: [], placeholders: [], plugin_effects: [], primary_color_wheels: [], realtime_denoises: [], shapes: [], smart_crops: [], smart_relights: [], sound_channel_mappings: [], speeds: [], stickers: [], tail_leaders: [], text_templates: [], texts: [], time_marks: [], transitions: [], video_effects: [], video_trackings: [], videos: [], vocal_separations: [] },
      mutable_config: null, name: projectName, new_version: "113.0.0",
      platform: { app_id: 359289, app_source: "cc", app_version: "4.0.0", device_id: "", hard_disk_id: "", mac_address: "", os: "windows", os_version: "10.0.22631" },
      relationships: [], render_index_track_mode_on: false, retouch_cover: null, source: "default",
      static_cover_image_path: "", tracks: [], update_time: Math.floor(timestamp / 1000), version: 360000
    };

    const draftPath = path.join(projectPath, 'draft_content.json');
    fs.writeFileSync(draftPath, JSON.stringify(draftContent, null, 2));

    const draftInfo = {
      draft_cloud_capcut_purchase_info: null, draft_cloud_purchase_info: null, draft_cloud_template_id: "",
      draft_cloud_tutorial_info: null, draft_cloud_videocut_purchase_info: null, draft_cover: "", draft_deeplink_url: "",
      draft_enterprise_info: null, draft_fold_path: projectPath, draft_id: draftId, draft_is_ai_shorts: false,
      draft_is_article_video_draft: false, draft_is_from_deeplink: false, draft_is_invisible: false, draft_materials_copied: false,
      draft_materials_copied_path: null, draft_name: projectName, draft_new_version: "", draft_removable_storage_device: "",
      draft_root_path: capCutDrafts, draft_segment_extra_info: null, draft_timeline_materials_size: 0, draft_type: "normal",
      tm_draft_cloud_completed: null, tm_draft_cloud_modified: 0, tm_draft_create: Math.floor(timestamp / 1000),
      tm_draft_modified: Math.floor(timestamp / 1000), tm_draft_removed: 0
    };
    fs.writeFileSync(path.join(projectPath, 'draft_info.json'), JSON.stringify(draftInfo, null, 2));

    // Criar draft_meta_info.json - CRÍTICO para o CapCut reconhecer o projeto
    const draftMetaInfo = {
      cloud_draft_cover: true,
      cloud_draft_sync: true,
      draft_cloud_last_action_download: false,
      draft_cloud_purchase_info: "",
      draft_cloud_template_id: "",
      draft_cloud_tutorial_info: "",
      draft_cloud_videocut_purchase_info: "",
      draft_cover: "",
      draft_enterprise_info: { draft_enterprise_extra: "", draft_enterprise_id: "", draft_enterprise_name: "", enterprise_material: [] },
      draft_fold_path: projectPath.replace(/\\/g, '/'),
      draft_id: draftId,
      draft_is_ai_shorts: false,
      draft_is_article_video_draft: false,
      draft_is_cloud_temp_draft: false,
      draft_is_from_deeplink: "false",
      draft_is_invisible: false,
      draft_is_web_article_video: false,
      draft_materials: [
        { type: 0, value: [] },  // videos/fotos
        { type: 1, value: [] },  // imagens
        { type: 2, value: [] },  // texto/legendas
        { type: 3, value: [] },
        { type: 6, value: [] },  // audio
        { type: 7, value: [] },
        { type: 8, value: [] }
      ],
      draft_materials_copied_info: [],
      draft_name: projectName,
      draft_need_rename_folder: false,
      draft_new_version: "",
      draft_removable_storage_device: "",
      draft_root_path: capCutDrafts.replace(/\\/g, '/'),
      draft_segment_extra_info: [],
      draft_timeline_materials_size_: 0,
      draft_type: "",
      tm_draft_create: microTimestamp,
      tm_draft_modified: microTimestamp,
      tm_draft_removed: 0,
      tm_duration: 0
    };
    fs.writeFileSync(path.join(projectPath, 'draft_meta_info.json'), JSON.stringify(draftMetaInfo));

    // Registrar no root_meta_info.json para aparecer no CapCut
    const rootMetaPath = path.join(capCutDrafts, 'root_meta_info.json');
    let rootMeta = { all_draft_store: [], draft_ids: 0, root_path: capCutDrafts.replace(/\\/g, '/') };
    if (fs.existsSync(rootMetaPath)) {
      try { rootMeta = JSON.parse(fs.readFileSync(rootMetaPath, 'utf-8')); } catch (e) { console.error('Error reading root_meta_info:', e); }
    }

    const newDraftEntry = {
      cloud_draft_cover: true, cloud_draft_sync: true, draft_cloud_last_action_download: false,
      draft_cloud_purchase_info: "", draft_cloud_template_id: "", draft_cloud_tutorial_info: "",
      draft_cloud_videocut_purchase_info: "", draft_cover: "",
      draft_fold_path: projectPath.replace(/\\/g, '/'),
      draft_id: draftId, draft_is_ai_shorts: false, draft_is_cloud_temp_draft: false, draft_is_invisible: false,
      draft_is_web_article_video: false, draft_json_file: projectPath.replace(/\\/g, '/') + '/draft_content.json',
      draft_name: projectName, draft_new_version: "", draft_root_path: capCutDrafts.replace(/\\/g, '/'),
      draft_timeline_materials_size: 0, draft_type: "", draft_web_article_video_enter_from: "",
      streaming_edit_draft_ready: true, tm_draft_cloud_completed: "", tm_draft_cloud_entry_id: -1,
      tm_draft_cloud_modified: 0, tm_draft_cloud_parent_entry_id: -1, tm_draft_cloud_space_id: -1,
      tm_draft_cloud_user_id: -1, tm_draft_create: microTimestamp, tm_draft_modified: microTimestamp,
      tm_draft_removed: 0, tm_duration: 0
    };

    rootMeta.all_draft_store.unshift(newDraftEntry);
    rootMeta.draft_ids = (rootMeta.draft_ids || 0) + 1;
    fs.writeFileSync(rootMetaPath, JSON.stringify(rootMeta));

    // Ensure all project files use consistent draft_id
    ensureConsistentDraftId(projectPath, capCutDrafts);

    return { success: true, path: projectPath, name: projectName, draftPath: draftPath };
  } catch (error) {
    return { error: error.message };
  }
});

// ============ RENAME PROJECT ============
ipcMain.handle('rename-project', async (_, { projectPath, newName }) => {
  try {
    const oldName = path.basename(projectPath);
    const parentDir = path.dirname(projectPath);
    const newPath = path.join(parentDir, newName);

    // Verificar se já existe pasta com esse nome
    if (fs.existsSync(newPath)) {
      return { error: 'Já existe um projeto com esse nome' };
    }

    // Renomear a pasta
    fs.renameSync(projectPath, newPath);

    // Atualizar draft_info.json
    const draftInfoPath = path.join(newPath, 'draft_info.json');
    if (fs.existsSync(draftInfoPath)) {
      const draftInfo = JSON.parse(fs.readFileSync(draftInfoPath, 'utf-8'));
      draftInfo.draft_name = newName;
      draftInfo.draft_fold_path = newPath;
      fs.writeFileSync(draftInfoPath, JSON.stringify(draftInfo, null, 2));
    }

    // Atualizar draft_meta_info.json
    const draftMetaInfoPath = path.join(newPath, 'draft_meta_info.json');
    if (fs.existsSync(draftMetaInfoPath)) {
      const draftMetaInfo = JSON.parse(fs.readFileSync(draftMetaInfoPath, 'utf-8'));
      draftMetaInfo.draft_name = newName;
      draftMetaInfo.draft_fold_path = newPath.replace(/\\/g, '/');
      fs.writeFileSync(draftMetaInfoPath, JSON.stringify(draftMetaInfo));
    }

    // Atualizar draft_content.json
    const draftContentPath = path.join(newPath, 'draft_content.json');
    if (fs.existsSync(draftContentPath)) {
      const draftContent = JSON.parse(fs.readFileSync(draftContentPath, 'utf-8'));
      draftContent.name = newName;
      fs.writeFileSync(draftContentPath, JSON.stringify(draftContent, null, 2));
    }

    // Atualizar root_meta_info.json
    const capCutDrafts = path.join(app.getPath('appData'), '..', 'Local', 'CapCut', 'User Data', 'Projects', 'com.lveditor.draft');
    const rootMetaPath = path.join(capCutDrafts, 'root_meta_info.json');
    if (fs.existsSync(rootMetaPath)) {
      const rootMeta = JSON.parse(fs.readFileSync(rootMetaPath, 'utf-8'));
      const draftEntry = rootMeta.all_draft_store?.find(d => d.draft_fold_path?.includes(oldName));
      if (draftEntry) {
        draftEntry.draft_name = newName;
        draftEntry.draft_fold_path = newPath.replace(/\\/g, '/');
        draftEntry.draft_json_file = path.join(newPath, 'draft_content.json').replace(/\\/g, '/');
        fs.writeFileSync(rootMetaPath, JSON.stringify(rootMeta));
      }
    }

    return {
      success: true,
      newPath,
      newName,
      newDraftPath: path.join(newPath, 'draft_content.json')
    };
  } catch (error) {
    return { error: error.message };
  }
});

// ============ CREATE FROM TEMPLATE ============
ipcMain.handle('create-from-template', async (_, { templatePath, newName, keepMedia, expandEffects }) => {
  try {
    const capCutDrafts = path.join(app.getPath('appData'), '..', 'Local', 'CapCut', 'User Data', 'Projects', 'com.lveditor.draft');
    if (!fs.existsSync(capCutDrafts)) {
      return { error: 'Pasta de projetos do CapCut nao encontrada.' };
    }

    const timestamp = Date.now();
    const microTimestamp = timestamp * 1000 + Math.floor(Math.random() * 1000);
    const projectName = newName || `Template_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${timestamp}`;
    const projectPath = path.join(capCutDrafts, projectName);
    const newDraftId = generateUUID();

    // Verificar se já existe
    if (fs.existsSync(projectPath)) {
      return { error: 'Já existe um projeto com esse nome' };
    }

    // Criar pasta do novo projeto
    fs.mkdirSync(projectPath, { recursive: true });

    // Ler o draft_content.json do template
    const templateDraftPath = path.join(templatePath, 'draft_content.json');
    if (!fs.existsSync(templateDraftPath)) {
      return { error: 'Template não contém draft_content.json' };
    }

    const templateContent = JSON.parse(fs.readFileSync(templateDraftPath, 'utf-8'));

    // Modificar o conteúdo
    templateContent.id = newDraftId;
    templateContent.name = projectName;
    templateContent.create_time = Math.floor(timestamp / 1000);
    templateContent.update_time = Math.floor(timestamp / 1000);

    // Se não manter mídias, REMOVER tracks de video/audio e manter apenas efeitos/filtros/texto
    if (!keepMedia) {
      // Remover completamente as tracks de video e audio (manter text, effect, filter)
      templateContent.tracks = (templateContent.tracks || []).filter(track =>
        !['video', 'audio'].includes(track.type)
      );

      // Limpar TODOS os materiais de mídia
      if (templateContent.materials) {
        templateContent.materials.videos = [];
        templateContent.materials.audios = [];
        templateContent.materials.images = [];
        // Limpar também efeitos de áudio e configurações relacionadas a mídia
        templateContent.materials.audio_balances = [];
        templateContent.materials.audio_effects = [];
        templateContent.materials.audio_fades = [];
        templateContent.materials.loudnesses = [];
        templateContent.materials.sound_channel_mappings = [];
        templateContent.materials.speeds = [];
        templateContent.materials.vocal_separations = [];
        templateContent.materials.video_trackings = [];
      }

      // Resetar duração para 0
      templateContent.duration = 0;

      // Limpar keyframes de video e audio
      if (templateContent.keyframes) {
        templateContent.keyframes.videos = [];
        templateContent.keyframes.audios = [];
      }
    }

    // Se expandir efeitos, calcular a duração máxima e expandir tracks de efeito/filtro
    if (expandEffects && keepMedia) {
      // Calcular duração máxima da timeline
      let maxDuration = 0;
      (templateContent.tracks || []).forEach(track => {
        (track.segments || []).forEach(seg => {
          const end = (seg.target_timerange?.start || 0) + (seg.target_timerange?.duration || 0);
          if (end > maxDuration) maxDuration = end;
        });
      });

      // Expandir tracks de efeito e filtro
      if (maxDuration > 0) {
        templateContent.tracks = (templateContent.tracks || []).map(track => {
          if (['effect', 'filter'].includes(track.type) && track.segments?.length > 0) {
            track.segments = track.segments.map(seg => ({
              ...seg,
              target_timerange: {
                ...seg.target_timerange,
                start: 0,
                duration: maxDuration
              }
            }));
          }
          return track;
        });
      }
    }

    // Salvar draft_content.json
    const draftPath = path.join(projectPath, 'draft_content.json');
    fs.writeFileSync(draftPath, JSON.stringify(templateContent, null, 2));

    // Criar draft_info.json
    const draftInfo = {
      draft_cloud_capcut_purchase_info: null, draft_cloud_purchase_info: null, draft_cloud_template_id: "",
      draft_cloud_tutorial_info: null, draft_cloud_videocut_purchase_info: null, draft_cover: "", draft_deeplink_url: "",
      draft_enterprise_info: null, draft_fold_path: projectPath, draft_id: newDraftId, draft_is_ai_shorts: false,
      draft_is_article_video_draft: false, draft_is_from_deeplink: false, draft_is_invisible: false, draft_materials_copied: false,
      draft_materials_copied_path: null, draft_name: projectName, draft_new_version: "", draft_removable_storage_device: "",
      draft_root_path: capCutDrafts, draft_segment_extra_info: null, draft_timeline_materials_size: 0, draft_type: "normal",
      tm_draft_cloud_completed: null, tm_draft_cloud_modified: 0, tm_draft_create: Math.floor(timestamp / 1000),
      tm_draft_modified: Math.floor(timestamp / 1000), tm_draft_removed: 0
    };
    fs.writeFileSync(path.join(projectPath, 'draft_info.json'), JSON.stringify(draftInfo, null, 2));

    // Criar draft_meta_info.json
    const draftMetaInfo = {
      cloud_draft_cover: true, cloud_draft_sync: true, draft_cloud_last_action_download: false,
      draft_cloud_purchase_info: "", draft_cloud_template_id: "", draft_cloud_tutorial_info: "",
      draft_cloud_videocut_purchase_info: "", draft_cover: "",
      draft_enterprise_info: { draft_enterprise_extra: "", draft_enterprise_id: "", draft_enterprise_name: "", enterprise_material: [] },
      draft_fold_path: projectPath.replace(/\\/g, '/'), draft_id: newDraftId,
      draft_is_ai_shorts: false, draft_is_article_video_draft: false, draft_is_cloud_temp_draft: false,
      draft_is_from_deeplink: "false", draft_is_invisible: false, draft_is_web_article_video: false,
      draft_materials: [
        { type: 0, value: [] }, { type: 1, value: [] }, { type: 2, value: [] },
        { type: 3, value: [] }, { type: 6, value: [] }, { type: 7, value: [] }, { type: 8, value: [] }
      ],
      draft_materials_copied_info: [], draft_name: projectName, draft_need_rename_folder: false,
      draft_new_version: "", draft_removable_storage_device: "",
      draft_root_path: capCutDrafts.replace(/\\/g, '/'), draft_segment_extra_info: [],
      draft_timeline_materials_size_: 0, draft_type: "",
      tm_draft_create: microTimestamp, tm_draft_modified: microTimestamp, tm_draft_removed: 0, tm_duration: 0
    };
    fs.writeFileSync(path.join(projectPath, 'draft_meta_info.json'), JSON.stringify(draftMetaInfo));

    // Registrar no root_meta_info.json
    const rootMetaPath = path.join(capCutDrafts, 'root_meta_info.json');
    let rootMeta = { all_draft_store: [], draft_ids: 0, root_path: capCutDrafts.replace(/\\/g, '/') };
    if (fs.existsSync(rootMetaPath)) {
      try { rootMeta = JSON.parse(fs.readFileSync(rootMetaPath, 'utf-8')); } catch (e) { console.error('Error reading root_meta_info:', e); }
    }

    const newDraftEntry = {
      cloud_draft_cover: true, cloud_draft_sync: true, draft_cloud_last_action_download: false,
      draft_cloud_purchase_info: "", draft_cloud_template_id: "", draft_cloud_tutorial_info: "",
      draft_cloud_videocut_purchase_info: "", draft_cover: "",
      draft_fold_path: projectPath.replace(/\\/g, '/'), draft_id: newDraftId,
      draft_is_ai_shorts: false, draft_is_cloud_temp_draft: false, draft_is_invisible: false,
      draft_is_web_article_video: false, draft_json_file: draftPath.replace(/\\/g, '/'),
      draft_name: projectName, draft_new_version: "", draft_root_path: capCutDrafts.replace(/\\/g, '/'),
      draft_timeline_materials_size: 0, draft_type: "", draft_web_article_video_enter_from: "",
      streaming_edit_draft_ready: true, tm_draft_cloud_completed: "", tm_draft_cloud_entry_id: -1,
      tm_draft_cloud_modified: 0, tm_draft_cloud_parent_entry_id: -1, tm_draft_cloud_space_id: -1,
      tm_draft_cloud_user_id: -1, tm_draft_create: microTimestamp, tm_draft_modified: microTimestamp,
      tm_draft_removed: 0, tm_duration: 0
    };

    rootMeta.all_draft_store.unshift(newDraftEntry);
    rootMeta.draft_ids = (rootMeta.draft_ids || 0) + 1;
    fs.writeFileSync(rootMetaPath, JSON.stringify(rootMeta));

    return {
      success: true,
      path: projectPath,
      name: projectName,
      draftPath: draftPath,
      templateName: path.basename(templatePath)
    };
  } catch (error) {
    return { error: error.message };
  }
});

// ============ DELETE PROJECT ============
ipcMain.handle('delete-project', async (_, { projectPath }) => {
  try {
    if (!fs.existsSync(projectPath)) {
      return { error: 'Projeto não encontrado' };
    }

    const projectName = path.basename(projectPath);

    // Remover do root_meta_info.json primeiro
    const capCutDrafts = path.join(app.getPath('appData'), '..', 'Local', 'CapCut', 'User Data', 'Projects', 'com.lveditor.draft');
    const rootMetaPath = path.join(capCutDrafts, 'root_meta_info.json');
    if (fs.existsSync(rootMetaPath)) {
      const rootMeta = JSON.parse(fs.readFileSync(rootMetaPath, 'utf-8'));
      rootMeta.all_draft_store = (rootMeta.all_draft_store || []).filter(
        d => !d.draft_fold_path?.includes(projectName)
      );
      fs.writeFileSync(rootMetaPath, JSON.stringify(rootMeta));
    }

    // Deletar a pasta do projeto recursivamente
    fs.rmSync(projectPath, { recursive: true, force: true });

    return { success: true, deletedName: projectName };
  } catch (error) {
    return { error: error.message };
  }
});

// ============ DELETE MULTIPLE PROJECTS ============
ipcMain.handle('delete-multiple-projects', async (_, { projectPaths }) => {
  try {
    if (!projectPaths || projectPaths.length === 0) {
      return { error: 'Nenhum projeto selecionado' };
    }

    const capCutDrafts = path.join(app.getPath('appData'), '..', 'Local', 'CapCut', 'User Data', 'Projects', 'com.lveditor.draft');
    const rootMetaPath = path.join(capCutDrafts, 'root_meta_info.json');

    const deleted = [];
    const errors = [];

    // Read root_meta_info once
    let rootMeta = { all_draft_store: [] };
    if (fs.existsSync(rootMetaPath)) {
      rootMeta = JSON.parse(fs.readFileSync(rootMetaPath, 'utf-8'));
    }

    for (const projectPath of projectPaths) {
      try {
        if (!fs.existsSync(projectPath)) {
          errors.push({ path: projectPath, error: 'Não encontrado' });
          continue;
        }

        const projectName = path.basename(projectPath);

        // Remove from root_meta_info
        rootMeta.all_draft_store = (rootMeta.all_draft_store || []).filter(
          d => !d.draft_fold_path?.includes(projectName)
        );

        // Delete project folder
        fs.rmSync(projectPath, { recursive: true, force: true });
        deleted.push(projectName);
      } catch (e) {
        errors.push({ path: projectPath, error: e.message });
      }
    }

    // Save root_meta_info once
    fs.writeFileSync(rootMetaPath, JSON.stringify(rootMeta));

    return {
      success: true,
      deletedCount: deleted.length,
      deleted,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    return { error: error.message };
  }
});

// ============ DELETE TRACKS BY TYPE ============
ipcMain.handle('delete-tracks-by-type', async (_, { draftPath, trackTypes }) => {
  try {
    if (!fs.existsSync(draftPath)) {
      return { error: 'Arquivo draft_content.json não encontrado' };
    }

    const content = JSON.parse(fs.readFileSync(draftPath, 'utf-8'));

    // Contar tracks antes
    const tracksBefore = (content.tracks || []).length;

    // Filtrar tracks removendo os tipos especificados
    content.tracks = (content.tracks || []).filter(track => !trackTypes.includes(track.type));

    // Se removendo texto/legendas, limpar materials.texts também
    if (trackTypes.includes('text')) {
      if (content.materials) {
        content.materials.texts = [];
        content.materials.text_templates = [];
      }
    }

    // Se removendo efeitos, limpar materials.video_effects
    if (trackTypes.includes('effect')) {
      if (content.materials) {
        content.materials.video_effects = [];
      }
    }

    // Se removendo filtros, limpar materials.material_animations com filtros
    if (trackTypes.includes('filter')) {
      if (content.materials) {
        content.materials.filters = [];
      }
    }

    // Atualizar timestamp
    content.update_time = Math.floor(Date.now() / 1000);

    const tracksAfter = (content.tracks || []).length;
    const removedCount = tracksBefore - tracksAfter;

    fs.writeFileSync(draftPath, JSON.stringify(content, null, 2));

    return { success: true, removedCount, remainingTracks: tracksAfter };
  } catch (error) {
    return { error: error.message };
  }
});

// ============ DELETE SPECIFIC TRACK ============
ipcMain.handle('delete-track', async (_, { draftPath, trackIndex }) => {
  try {
    if (!fs.existsSync(draftPath)) {
      return { error: 'Arquivo draft_content.json não encontrado' };
    }

    const content = JSON.parse(fs.readFileSync(draftPath, 'utf-8'));

    if (!content.tracks || trackIndex < 0 || trackIndex >= content.tracks.length) {
      return { error: 'Track não encontrada' };
    }

    const removedTrack = content.tracks[trackIndex];
    content.tracks.splice(trackIndex, 1);
    content.update_time = Math.floor(Date.now() / 1000);

    fs.writeFileSync(draftPath, JSON.stringify(content, null, 2));

    return { success: true, removedTrack: { type: removedTrack.type, index: trackIndex } };
  } catch (error) {
    return { error: error.message };
  }
});

// ============ DIALOG HANDLERS ============
ipcMain.handle('dialog:openFile', async (_, options) => {
  return dialog.showOpenDialog(mainWindow, options);
});

ipcMain.handle('list-files-in-folder', async (_, { folderPath, extensions }) => {
  try {
    const files = fs.readdirSync(folderPath)
      .filter(file => {
        const ext = path.extname(file).toLowerCase().slice(1);
        return extensions.includes(ext);
      })
      .map(file => path.join(folderPath, file));
    return { files };
  } catch (error) {
    return { error: error.message, files: [] };
  }
});

// ============ AUTO-UPDATE HANDLERS ============
ipcMain.handle('check-for-updates', async () => {
  return await checkForUpdates();
});

ipcMain.handle('download-update', async (_, downloadUrl) => {
  return await performUpdate(downloadUrl);
});

ipcMain.handle('get-app-version', () => APP_VERSION);

// ============ CHECK CAPCUT STATUS ============
ipcMain.handle('check-capcut-running', () => {
  return { isRunning: isCapCutRunning() };
});

// ============ FETCH NEWS ============
const NEWS_URL = 'https://nardoto.com.br/nardoto-updates/capcut-sync-pro-news.json';

ipcMain.handle('fetch-news', async () => {
  return new Promise((resolve) => {
    https.get(NEWS_URL, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const news = JSON.parse(data);
          resolve({ success: true, news });
        } catch (e) {
          // Fallback news if fetch fails
          resolve({
            success: true,
            news: {
              title: 'Sistema de Templates',
              description: 'Crie projetos a partir de templates existentes',
              badge: 'NOVO',
              link: null
            }
          });
        }
      });
    }).on('error', () => {
      resolve({
        success: true,
        news: {
          title: 'Sistema de Templates',
          description: 'Crie projetos a partir de templates existentes',
          badge: 'NOVO',
          link: null
        }
      });
    });
  });
});

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
ipcMain.handle('insert-srt', async (_, { draftPath, srtFolders, createTitle, selectedFiles, separateTracks }) => {
  // selectedFiles now contains full paths (srtPath), not just filenames
  // srtFolders is an array of all scanned folders
  // separateTracks: if true, creates separate track for each audio file's subtitles
  return runPython({ action: 'insert_srt', draftPath, srtFolders, createTitle, selectedFilePaths: selectedFiles, separateTracks });
});

// ============ BATCH SRT SCAN (no audio matching) ============
ipcMain.handle('scan-srt-batch', async (_, { srtFolder }) => {
  try {
    const files = fs.readdirSync(srtFolder);
    const srtFiles = files.filter(f => f.toLowerCase().endsWith('.srt'));

    const result = srtFiles.map(srtFile => {
      const srtPath = path.join(srtFolder, srtFile);
      const baseName = path.basename(srtFile, '.srt');
      const srtContent = fs.readFileSync(srtPath, 'utf-8');
      const subtitleCount = (srtContent.match(/^\d+$/gm) || []).length;

      return {
        srtFile,
        srtPath,
        baseName,
        subtitleCount,
        matched: false
      };
    });

    return { files: result };
  } catch (error) {
    return { error: error.message };
  }
});

// ============ INSERT SRT BATCH (sequential, no audio reference) ============
ipcMain.handle('insert-srt-batch', async (_, { draftPath, srtFiles, createTitle, gapMs }) => {
  // srtFiles is an array of full paths
  // gapMs is the gap between each SRT block in microseconds
  return runPython({ action: 'insert_srt_batch', draftPath, srtFiles, createTitle, gapMs });
});

// ============ CREATE AND INSERT SRT FROM SCRIPT ============
ipcMain.handle('create-and-insert-srt', async (_, { draftPath, srtContent, fileName, createTitle }) => {
  try {
    // Get project folder (parent of draft_content.json)
    const projectFolder = path.dirname(draftPath);

    // Create srt subfolder if it doesn't exist
    const srtFolder = path.join(projectFolder, 'srt');
    if (!fs.existsSync(srtFolder)) {
      fs.mkdirSync(srtFolder, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const safeFileName = fileName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const srtPath = path.join(srtFolder, `${safeFileName}_${timestamp}.srt`);

    // Save SRT file
    fs.writeFileSync(srtPath, srtContent, 'utf-8');
    console.log('[CreateSRT] File saved:', srtPath);

    // Count subtitles
    const subtitleCount = (srtContent.match(/^\d+$/gm) || []).length;

    // Insert into project using the batch method (single file)
    const result = runPython({
      action: 'insert_srt_batch',
      draftPath,
      srtFiles: [srtPath],
      createTitle,
      gapMs: 0  // No gap needed for single file
    });

    if (result.error) {
      return { error: result.error };
    }

    return {
      srtPath,
      stats: {
        totalSubtitles: subtitleCount,
        ...result.stats
      }
    };
  } catch (error) {
    console.error('[CreateSRT] Error:', error);
    return { error: error.message };
  }
});

// ============ INSERT MEDIA BATCH (video/image) ============
ipcMain.handle('run-python', async (_, command) => {
  return runPython(command);
});

// ============ CONTENT CREATOR (Google AI) ============
// Armazena processos em execucao
const runningGenerations = new Map();

// Inicia a geracao e retorna o progressFile imediatamente
ipcMain.handle('start-content-generation', async (_, params) => {
  const basePath = app.isPackaged
    ? process.resourcesPath
    : process.cwd();

  const pythonScript = path.join(basePath, 'python', 'content_creator.py');
  const timestamp = Date.now();
  const progressFile = path.join(app.getPath('temp'), `content_progress_${timestamp}.json`);
  const tempFile = path.join(app.getPath('temp'), `content_cmd_${timestamp}.json`);

  // Adicionar arquivo de progresso aos params
  params.progressFile = progressFile;
  params.action = 'generate';

  // Criar arquivo de progresso inicial
  fs.writeFileSync(progressFile, JSON.stringify({ progress: 0, status: 'Iniciando...' }));
  fs.writeFileSync(tempFile, JSON.stringify(params));

  // Iniciar processo Python
  const pythonProcess = spawn('python', [pythonScript, '--file', tempFile], {
    encoding: 'utf-8'
  });

  let stdout = '';
  let stderr = '';

  pythonProcess.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    const msg = data.toString();
    stderr += msg;
    // Log stderr em tempo real para debug
    console.log('[ContentCreator-Debug]', msg.trim());
  });

  // Criar promise para aguardar resultado
  const resultPromise = new Promise((resolve) => {
    pythonProcess.on('close', (code) => {
      // Limpar arquivo de comando
      try { fs.unlinkSync(tempFile); } catch {}

      if (code === 0 && stdout) {
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch {
          resolve({ success: false, error: 'Failed to parse response' });
        }
      } else {
        resolve({ success: false, error: stderr || 'Process failed' });
      }
    });
  });

  // Armazenar processo
  runningGenerations.set(progressFile, { process: pythonProcess, resultPromise, tempFile });

  return progressFile;
});

// Aguarda a geracao terminar e retorna o resultado
ipcMain.handle('wait-content-generation', async (_, progressFile) => {
  const generation = runningGenerations.get(progressFile);
  if (!generation) {
    return { success: false, error: 'Generation not found' };
  }

  try {
    const result = await generation.resultPromise;
    // Limpar arquivo de progresso
    try { fs.unlinkSync(progressFile); } catch {}
    runningGenerations.delete(progressFile);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Cancela uma geracao em andamento
ipcMain.handle('cancel-content-generation', async (_, progressFile) => {
  const generation = runningGenerations.get(progressFile);
  if (!generation) {
    return { success: false, error: 'Generation not found' };
  }

  try {
    // Matar o processo Python
    if (generation.process && !generation.process.killed) {
      generation.process.kill('SIGTERM');
      // Forcar kill se nao morrer em 2 segundos
      setTimeout(() => {
        if (generation.process && !generation.process.killed) {
          generation.process.kill('SIGKILL');
        }
      }, 2000);
    }

    // Limpar arquivos
    try { fs.unlinkSync(progressFile); } catch {}
    try { fs.unlinkSync(generation.tempFile); } catch {}

    runningGenerations.delete(progressFile);
    console.log('[ContentCreator] Generation cancelled');
    return { success: true, cancelled: true };
  } catch (error) {
    console.error('[ContentCreator] Error cancelling:', error);
    return { success: false, error: error.message };
  }
});

// Handler antigo para compatibilidade
ipcMain.handle('generate-content', async (_, params) => {
  const basePath = app.isPackaged
    ? process.resourcesPath
    : process.cwd();

  const pythonScript = path.join(basePath, 'python', 'content_creator.py');
  const progressFile = path.join(app.getPath('temp'), `content_progress_${Date.now()}.json`);

  params.progressFile = progressFile;
  params.action = 'generate';

  fs.writeFileSync(progressFile, JSON.stringify({ progress: 0, status: 'Iniciando...' }));

  return new Promise((resolve) => {
    const tempFile = path.join(app.getPath('temp'), `content_cmd_${Date.now()}.json`);
    fs.writeFileSync(tempFile, JSON.stringify(params));

    const pythonProcess = spawn('python', [pythonScript, '--file', tempFile], {
      encoding: 'utf-8'
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { stderr += data.toString(); });

    pythonProcess.on('close', (code) => {
      try { fs.unlinkSync(tempFile); } catch {}
      try { fs.unlinkSync(progressFile); } catch {}

      if (code === 0 && stdout) {
        try { resolve(JSON.parse(stdout.trim())); }
        catch { resolve({ success: false, error: 'Failed to parse response' }); }
      } else {
        resolve({ success: false, error: stderr || 'Process failed' });
      }
    });
  });
});

// ============ CONTENT CREATOR PROGRESS ============
ipcMain.handle('get-content-progress', async (_, progressFile) => {
  try {
    if (fs.existsSync(progressFile)) {
      return JSON.parse(fs.readFileSync(progressFile, 'utf-8'));
    }
  } catch {}
  return { progress: 0, status: 'Aguardando...' };
});

// ============ VOICE PREVIEW (TTS) ============
ipcMain.handle('preview-voice', async (_, { apiKey, voice, text }) => {
  const basePath = app.isPackaged
    ? process.resourcesPath
    : process.cwd();

  const pythonScript = path.join(basePath, 'python', 'content_creator.py');
  const outputFile = path.join(app.getPath('temp'), `voice_preview_${Date.now()}.wav`);

  const params = {
    action: 'preview_voice',
    apiKey,
    voice,
    text: text || 'Ola, esta e a minha voz. Como voce pode ouvir, eu sou perfeita para narrar seus videos.',
    outputFile
  };

  return new Promise((resolve) => {
    const tempFile = path.join(app.getPath('temp'), `voice_cmd_${Date.now()}.json`);
    fs.writeFileSync(tempFile, JSON.stringify(params));

    const pythonProcess = spawn('python', [pythonScript, '--file', tempFile], {
      encoding: 'utf-8'
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { stderr += data.toString(); });

    pythonProcess.on('close', (code) => {
      try { fs.unlinkSync(tempFile); } catch {}

      if (code === 0 && stdout) {
        try {
          const result = JSON.parse(stdout.trim());
          resolve(result);
        } catch {
          resolve({ success: false, error: 'Failed to parse response' });
        }
      } else {
        resolve({ success: false, error: stderr || 'Process failed' });
      }
    });
  });
});

// ============ GET VOICE PREVIEW PATH ============
ipcMain.handle('get-voice-preview-path', async (_, voiceId) => {
  const basePath = app.isPackaged
    ? process.resourcesPath
    : process.cwd();
  const voicePath = path.join(basePath, 'assets', 'voices', `${voiceId.toLowerCase()}.wav`);

  // Verificar se o arquivo existe
  if (fs.existsSync(voicePath)) {
    return voicePath;
  }
  return null;
});

// ============ INSERT CREATOR CONTENT ============
ipcMain.handle('insert-creator-content', async (_, { draftPath, contentFolder, addAnimations }) => {
  return runPython({
    action: 'insert_creator',
    draftPath,
    contentFolder,
    addAnimations: addAnimations !== false
  });
});

// ============ IMPORT MEDIA FOLDER ============
ipcMain.handle('import-media-folder', async (_, { draftPath, folderPath, addAnimations, syncToAudio, separateAudioTracks }) => {
  return runPython({
    action: 'import_folder',
    draftPath,
    folderPath,
    addAnimations: addAnimations !== false,
    syncToAudio: syncToAudio !== false,
    separateAudioTracks: separateAudioTracks === true
  });
});

// ============ SCAN MEDIA FOLDER (preview before import) ============
ipcMain.handle('scan-media-folder', async (_, folderPath) => {
  try {
    const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'];
    const VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
    const AUDIO_EXTS = ['.wav', '.mp3', '.m4a', '.aac', '.ogg', '.flac'];
    const SUBTITLE_EXTS = ['.srt', '.vtt', '.ass', '.sub'];
    const MAX_PATH_LENGTH = 260; // Windows MAX_PATH limit

    const files = fs.readdirSync(folderPath);
    const media = { images: [], videos: [], audios: [], subtitles: [] };

    // Track path length issues
    let longestPath = '';
    let longestPathLength = 0;
    let pathsExceedingLimit = 0;

    for (const f of files) {
      const fullPath = path.join(folderPath, f);
      if (!fs.statSync(fullPath).isFile()) continue;
      const ext = path.extname(f).toLowerCase();

      // Check path length
      if (fullPath.length > longestPathLength) {
        longestPath = fullPath;
        longestPathLength = fullPath.length;
      }
      if (fullPath.length >= MAX_PATH_LENGTH) {
        pathsExceedingLimit++;
      }

      if (IMAGE_EXTS.includes(ext)) media.images.push(f);
      else if (VIDEO_EXTS.includes(ext)) media.videos.push(f);
      else if (AUDIO_EXTS.includes(ext)) media.audios.push(f);
      else if (SUBTITLE_EXTS.includes(ext)) media.subtitles.push(f);
    }

    // Sort alphabetically
    media.images.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    media.videos.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    media.audios.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    media.subtitles.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    // Build path warning if needed
    let pathWarning = null;
    if (pathsExceedingLimit > 0 || longestPathLength > 230) {
      pathWarning = {
        hasLongPaths: pathsExceedingLimit > 0,
        nearLimit: longestPathLength > 230 && longestPathLength < MAX_PATH_LENGTH,
        longestPath,
        longestPathLength,
        pathsExceedingLimit,
        maxAllowed: MAX_PATH_LENGTH
      };
    }

    return {
      success: true,
      folderPath,
      // Return both formats for compatibility
      media,
      images: media.images,
      videos: media.videos,
      audios: media.audios,
      subtitles: media.subtitles,
      total: media.images.length + media.videos.length + media.audios.length + media.subtitles.length,
      pathWarning
    };
  } catch (error) {
    return { success: false, error: error.message, images: [], videos: [], audios: [], subtitles: [] };
  }
});

// ============ BACKUP / UNDO SYSTEM (Multi-level) ============

// Load backup descriptions from file
function loadBackupDescriptions(dir) {
  const descPath = path.join(dir, 'backup_descriptions.json');
  try {
    if (fs.existsSync(descPath)) {
      return JSON.parse(fs.readFileSync(descPath, 'utf-8'));
    }
  } catch (e) { console.error('Error loading backup descriptions:', e); }
  return {};
}

// Save backup descriptions to file
function saveBackupDescriptions(dir, descriptions) {
  const descPath = path.join(dir, 'backup_descriptions.json');
  try {
    fs.writeFileSync(descPath, JSON.stringify(descriptions, null, 2));
  } catch (e) { console.error('Error saving backup descriptions:', e); }
}

// List all backups for a project
ipcMain.handle('list-backups', async (_, draftPath) => {
  try {
    const dir = path.dirname(draftPath);
    const baseName = path.basename(draftPath, '.json');
    const files = fs.readdirSync(dir);

    // Load descriptions
    const descriptions = loadBackupDescriptions(dir);

    // Find all backup files: draft_content_backup_YYYYMMDD_HHMMSS.json
    const backups = files
      .filter(f => f.startsWith(baseName + '_backup_') && f.endsWith('.json'))
      .map(f => {
        const fullPath = path.join(dir, f);
        const stats = fs.statSync(fullPath);
        // Extract timestamp from filename: draft_content_backup_20251220_123456.json
        const match = f.match(/_backup_(\d{8})_(\d{6})\.json$/);
        let timestamp = stats.mtime;
        let displayDate = '';
        let timestampKey = '';
        if (match) {
          const dateStr = match[1]; // 20251220
          const timeStr = match[2]; // 123456
          timestampKey = `${dateStr}_${timeStr}`;
          const year = dateStr.substring(0, 4);
          const month = dateStr.substring(4, 6);
          const day = dateStr.substring(6, 8);
          const hour = timeStr.substring(0, 2);
          const min = timeStr.substring(2, 4);
          const sec = timeStr.substring(4, 6);
          displayDate = `${day}/${month} ${hour}:${min}:${sec}`;
          timestamp = new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}`);
        }
        return {
          filename: f,
          path: fullPath,
          timestamp: timestamp.getTime(),
          displayDate,
          size: stats.size,
          description: descriptions[timestampKey] || descriptions[f] || null
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp); // Most recent first

    return { backups, count: backups.length };
  } catch (error) {
    return { backups: [], count: 0, error: error.message };
  }
});

// Save description for the most recent backup
ipcMain.handle('save-backup-description', async (_, { draftPath, description }) => {
  try {
    const dir = path.dirname(draftPath);
    const descriptions = loadBackupDescriptions(dir);

    // Find most recent backup to associate description
    const baseName = path.basename(draftPath, '.json');
    const files = fs.readdirSync(dir);
    const backupFiles = files
      .filter(f => f.startsWith(baseName + '_backup_') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (backupFiles.length > 0) {
      const mostRecent = backupFiles[0];
      const match = mostRecent.match(/_backup_(\d{8}_\d{6})\.json$/);
      if (match) {
        descriptions[match[1]] = description;
        saveBackupDescriptions(dir, descriptions);
        return { success: true, filename: mostRecent };
      }
    }
    return { success: false, error: 'No backup found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Check if any backups exist
ipcMain.handle('check-backup', async (_, draftPath) => {
  try {
    const dir = path.dirname(draftPath);
    const baseName = path.basename(draftPath, '.json');
    const files = fs.readdirSync(dir);
    const hasBackup = files.some(f => f.startsWith(baseName + '_backup_') && f.endsWith('.json'));
    return { hasBackup };
  } catch (error) {
    return { hasBackup: false, error: error.message };
  }
});

// Restore a specific backup
ipcMain.handle('undo-changes', async (_, draftPath, backupFilename) => {
  try {
    const dir = path.dirname(draftPath);
    let backupPath;

    if (backupFilename) {
      // Restore specific backup
      backupPath = path.join(dir, backupFilename);
    } else {
      // Find most recent backup
      const baseName = path.basename(draftPath, '.json');
      const files = fs.readdirSync(dir);
      const backups = files
        .filter(f => f.startsWith(baseName + '_backup_') && f.endsWith('.json'))
        .sort()
        .reverse();
      if (backups.length === 0) {
        return { error: 'Nenhum backup encontrado para desfazer' };
      }
      backupPath = path.join(dir, backups[0]);
    }

    if (!fs.existsSync(backupPath)) {
      return { error: 'Backup não encontrado: ' + backupFilename };
    }

    // Restore backup
    fs.copyFileSync(backupPath, draftPath);
    return { success: true, restored: path.basename(backupPath) };
  } catch (error) {
    return { error: error.message };
  }
});

// Delete a specific backup
ipcMain.handle('delete-backup', async (_, draftPath, backupFilename) => {
  try {
    const dir = path.dirname(draftPath);
    const backupPath = path.join(dir, backupFilename);
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});

// Delete all backups for a project
ipcMain.handle('delete-all-backups', async (_, draftPath) => {
  try {
    const dir = path.dirname(draftPath);
    const baseName = path.basename(draftPath, '.json');
    const files = fs.readdirSync(dir);
    let deleted = 0;

    for (const f of files) {
      if (f.startsWith(baseName + '_backup_') && f.endsWith('.json')) {
        fs.unlinkSync(path.join(dir, f));
        deleted++;
      }
    }

    return { success: true, deleted };
  } catch (error) {
    return { error: error.message };
  }
});

// ============ DETECT CAPCUT PROJECTS FOLDER ============
ipcMain.handle('detect-capcut-folder', async (event, { customPath } = {}) => {
  try {
    const os = require('node:os');
    const homeDir = os.homedir();

    // Caminho padrão do CapCut no Windows ou customPath
    const capCutPath = customPath || path.join(homeDir, 'AppData', 'Local', 'CapCut', 'User Data', 'Projects', 'com.lveditor.draft');

    if (!fs.existsSync(capCutPath)) {
      return { error: customPath ? 'Pasta não encontrada' : 'Pasta do CapCut não encontrada no caminho padrão' };
    }

    // Listar projetos (pastas que contêm draft_content.json)
    const items = fs.readdirSync(capCutPath);
    const projects = [];

    for (const item of items) {
      const itemPath = path.join(capCutPath, item);
      const draftPath = path.join(itemPath, 'draft_content.json');

      if (fs.statSync(itemPath).isDirectory() && fs.existsSync(draftPath)) {
        // Pegar data de modificação e duração
        const stats = fs.statSync(draftPath);
        let duration = 0;
        try {
          const draftContent = JSON.parse(fs.readFileSync(draftPath, 'utf-8'));
          duration = draftContent.duration || 0;
        } catch (e) {
          // Ignore parse errors
        }
        projects.push({
          name: item,
          path: itemPath,
          draftPath: draftPath,
          modifiedAt: stats.mtime.toISOString(),
          duration: duration,
        });
      }
    }

    // Ordenar por data de modificação (mais recente primeiro)
    projects.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

    return {
      capCutPath,
      projects,
      count: projects.length
    };
  } catch (error) {
    return { error: error.message };
  }
});

// ============ SELECT CLOUD FOLDER ============
ipcMain.handle('select-cloud-folder', async () => {
  try {
    const os = require('node:os');
    const homeDir = os.homedir();

    // Caminho padrão da pasta Projects do CapCut
    const defaultPath = path.join(homeDir, 'AppData', 'Local', 'CapCut', 'User Data', 'Projects');

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Selecionar pasta de projetos de nuvem',
      defaultPath: fs.existsSync(defaultPath) ? defaultPath : homeDir,
      properties: ['openDirectory'],
      buttonLabel: 'Selecionar pasta'
    });

    if (result.canceled) {
      return { canceled: true };
    }

    const folderPath = result.filePaths[0];
    const folderName = path.basename(folderPath);

    return {
      folderPath,
      folderName
    };
  } catch (error) {
    return { error: error.message };
  }
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

// ============ HELPER: Copy all media files from source project to target ============
function copyProjectMedia(sourceProjectPath, targetProjectPath) {
  // Media file extensions to copy
  const mediaExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.mp4', '.mov', '.avi', '.mkv', '.mp3', '.m4a', '.wav', '.aac', '.ogg', '.flac'];
  let copiedCount = 0;

  try {
    // Read all files in source project folder
    const files = fs.readdirSync(sourceProjectPath);

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (mediaExtensions.includes(ext)) {
        const sourcePath = path.join(sourceProjectPath, file);
        const targetPath = path.join(targetProjectPath, file);

        // Only copy if source is a file (not directory)
        const stat = fs.statSync(sourcePath);
        if (stat.isFile()) {
          // Skip if already exists with same size
          if (fs.existsSync(targetPath)) {
            const targetStat = fs.statSync(targetPath);
            if (targetStat.size === stat.size) {
              console.log(`Skipping (exists): ${file}`);
              continue;
            }
          }

          fs.copyFileSync(sourcePath, targetPath);
          copiedCount++;
          console.log(`Copied: ${file}`);
        }
      }
    }

    console.log(`Media copy complete: ${copiedCount} files from ${path.basename(sourceProjectPath)}`);
  } catch (err) {
    console.error(`Error copying media from ${sourceProjectPath}:`, err.message);
  }

  return copiedCount;
}

// ============ HELPER: Replace placeholder paths in content ============
function replacePlaceholders(content, oldPlaceholderId, newPlaceholderId) {
  // Convert content to string
  const jsonString = typeof content === 'string' ? content : JSON.stringify(content);

  // Replace all occurrences of the old placeholder with the new one
  const oldPattern = `##_draftpath_placeholder_${oldPlaceholderId}_##`;
  const newPattern = `##_draftpath_placeholder_${newPlaceholderId}_##`;

  const updatedString = jsonString.split(oldPattern).join(newPattern);

  // Return as object if input was object
  return typeof content === 'string' ? updatedString : JSON.parse(updatedString);
}

// ============ HELPER: Extract placeholder ID from draft content ============
function extractPlaceholderId(content) {
  const jsonString = typeof content === 'string' ? content : JSON.stringify(content);
  const match = jsonString.match(/##_draftpath_placeholder_([A-F0-9-]+)_##/i);
  return match ? match[1] : null;
}

// ============ HELPER: Copy folder recursively ============
function copyFolderRecursive(source, target) {
  // Create target folder if it doesn't exist
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  // Get all files and folders in source
  const items = fs.readdirSync(source);

  for (const item of items) {
    const sourcePath = path.join(source, item);
    const targetPath = path.join(target, item);
    const stat = fs.statSync(sourcePath);

    if (stat.isDirectory()) {
      // Recursively copy subdirectory
      copyFolderRecursive(sourcePath, targetPath);
    } else {
      // Copy file
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

// ============ COPY CLOUD PROJECT TO LOCAL ============
ipcMain.handle('copy-project-to-local', async (_, { projectPath }) => {
  try {
    const capCutDrafts = path.join(app.getPath('appData'), '..', 'Local', 'CapCut', 'User Data', 'Projects', 'com.lveditor.draft');
    if (!fs.existsSync(capCutDrafts)) {
      return { error: 'Pasta de projetos do CapCut não encontrada.' };
    }

    if (!projectPath || !fs.existsSync(projectPath)) {
      return { error: 'Projeto não encontrado.' };
    }

    const draftContentPath = path.join(projectPath, 'draft_content.json');
    if (!fs.existsSync(draftContentPath)) {
      return { error: 'Arquivo draft_content.json não encontrado.' };
    }

    // Generate new project info
    const timestamp = Date.now();
    const microTimestamp = timestamp * 1000 + Math.floor(Math.random() * 1000);
    const originalName = path.basename(projectPath);
    const newProjectName = `${originalName}_local`;
    const newProjectPath = path.join(capCutDrafts, newProjectName);
    const newDraftId = generateUUID();

    // Check if already exists - delete and recreate
    if (fs.existsSync(newProjectPath)) {
      console.log(`Deleting existing folder: ${newProjectName}`);
      fs.rmSync(newProjectPath, { recursive: true, force: true });
    }

    // Copy entire folder recursively
    console.log(`Copying entire folder from ${originalName} to ${newProjectName}...`);
    copyFolderRecursive(projectPath, newProjectPath);
    console.log('Folder copy complete');

    // Read original draft content
    const draftContent = JSON.parse(fs.readFileSync(path.join(newProjectPath, 'draft_content.json'), 'utf-8'));

    // Replace placeholders with ABSOLUTE paths (CapCut local projects use absolute paths, not placeholders!)
    const oldPlaceholderId = extractPlaceholderId(draftContent);
    let updatedContent = draftContent;
    if (oldPlaceholderId) {
      // Convert placeholder to absolute path (use forward slashes like CapCut does)
      const absolutePath = newProjectPath.replace(/\\/g, '/');
      const placeholderPattern = `##_draftpath_placeholder_${oldPlaceholderId}_##`;
      console.log(`Replacing placeholder with absolute path: ${placeholderPattern} -> ${absolutePath}`);

      // Convert to string, replace, and parse back
      const jsonString = JSON.stringify(draftContent);
      const updatedString = jsonString.split(placeholderPattern).join(absolutePath);
      updatedContent = JSON.parse(updatedString);
    }

    // Save updated draft_content.json
    fs.writeFileSync(path.join(newProjectPath, 'draft_content.json'), JSON.stringify(updatedContent));

    // Create draft_info.json
    const draftInfo = {
      draft_cloud_capcut_purchase_info: null, draft_cloud_purchase_info: null, draft_cloud_template_id: '',
      draft_cloud_tutorial_info: null, draft_cloud_videocut_purchase_info: null, draft_cover: '', draft_deeplink_url: '',
      draft_enterprise_info: null, draft_fold_path: newProjectPath, draft_id: newDraftId, draft_is_ai_shorts: false,
      draft_is_article_video_draft: false, draft_is_from_deeplink: false, draft_is_invisible: false, draft_materials_copied: false,
      draft_materials_copied_path: null, draft_name: newProjectName, draft_new_version: '', draft_removable_storage_device: '',
      draft_root_path: capCutDrafts, draft_segment_extra_info: null, draft_timeline_materials_size: 0, draft_type: 'normal',
      tm_draft_cloud_completed: null, tm_draft_cloud_modified: 0, tm_draft_create: Math.floor(timestamp / 1000),
      tm_draft_modified: Math.floor(timestamp / 1000), tm_draft_removed: 0
    };
    fs.writeFileSync(path.join(newProjectPath, 'draft_info.json'), JSON.stringify(draftInfo, null, 2));

    // Create draft_meta_info.json
    const duration = updatedContent.duration || 0;
    const draftMetaInfo = {
      cloud_draft_cover: true, cloud_draft_sync: true, draft_cloud_last_action_download: false,
      draft_cloud_purchase_info: '', draft_cloud_template_id: '', draft_cloud_tutorial_info: '',
      draft_cloud_videocut_purchase_info: '', draft_cover: '',
      draft_enterprise_info: { draft_enterprise_extra: '', draft_enterprise_id: '', draft_enterprise_name: '', enterprise_material: [] },
      draft_fold_path: newProjectPath.replace(/\\/g, '/'), draft_id: newDraftId,
      draft_is_ai_shorts: false, draft_is_article_video_draft: false, draft_is_cloud_temp_draft: false,
      draft_is_from_deeplink: 'false', draft_is_invisible: false, draft_is_web_article_video: false,
      draft_materials: [
        { type: 0, value: [] }, { type: 1, value: [] }, { type: 2, value: [] },
        { type: 3, value: [] }, { type: 6, value: [] }, { type: 7, value: [] }, { type: 8, value: [] }
      ],
      draft_materials_copied_info: [], draft_name: newProjectName, draft_need_rename_folder: false,
      draft_new_version: '', draft_removable_storage_device: '',
      draft_root_path: capCutDrafts.replace(/\\/g, '/'), draft_segment_extra_info: [],
      draft_timeline_materials_size_: 0, draft_type: '',
      tm_draft_create: microTimestamp, tm_draft_modified: microTimestamp, tm_draft_removed: 0, tm_duration: duration
    };
    fs.writeFileSync(path.join(newProjectPath, 'draft_meta_info.json'), JSON.stringify(draftMetaInfo));

    // Register in root_meta_info.json
    const rootMetaPath = path.join(capCutDrafts, 'root_meta_info.json');
    let rootMeta = { all_draft_store: [], draft_ids: 0, root_path: capCutDrafts.replace(/\\/g, '/') };
    if (fs.existsSync(rootMetaPath)) {
      try { rootMeta = JSON.parse(fs.readFileSync(rootMetaPath, 'utf-8')); } catch (e) { console.error('Error reading root_meta_info:', e); }
    }

    const newDraftEntry = {
      cloud_draft_cover: true, cloud_draft_sync: true, draft_cloud_last_action_download: false,
      draft_cloud_purchase_info: '', draft_cloud_template_id: '', draft_cloud_tutorial_info: '',
      draft_cloud_videocut_purchase_info: '', draft_cover: '',
      draft_fold_path: newProjectPath.replace(/\\/g, '/'), draft_id: newDraftId,
      draft_is_ai_shorts: false, draft_is_cloud_temp_draft: false, draft_is_invisible: false,
      draft_is_web_article_video: false, draft_json_file: path.join(newProjectPath, 'draft_content.json').replace(/\\/g, '/'),
      draft_name: newProjectName, draft_new_version: '', draft_root_path: capCutDrafts.replace(/\\/g, '/'),
      draft_timeline_materials_size: 0, draft_type: '', draft_web_article_video_enter_from: '',
      streaming_edit_draft_ready: true, tm_draft_cloud_completed: '', tm_draft_cloud_entry_id: -1,
      tm_draft_cloud_modified: 0, tm_draft_cloud_parent_entry_id: -1, tm_draft_cloud_space_id: -1,
      tm_draft_cloud_user_id: -1, tm_draft_create: microTimestamp, tm_draft_modified: microTimestamp,
      tm_draft_removed: 0, tm_duration: duration
    };

    rootMeta.all_draft_store.unshift(newDraftEntry);
    rootMeta.draft_ids = (rootMeta.draft_ids || 0) + 1;
    fs.writeFileSync(rootMetaPath, JSON.stringify(rootMeta));

    // Ensure all project files use consistent draft_id
    ensureConsistentDraftId(newProjectPath, capCutDrafts);

    console.log(`Project copied to local: ${newProjectName}`);
    return { success: true, localPath: newProjectPath, projectName: newProjectName };
  } catch (err) {
    console.error('Error copying project to local:', err);
    return { error: err.message };
  }
});

// ============ MERGE PROJECTS ============
ipcMain.handle('merge-projects', async (_, { projectPaths, outputName, mode = 'flat' }) => {
  try {
    const capCutDrafts = path.join(app.getPath('appData'), '..', 'Local', 'CapCut', 'User Data', 'Projects', 'com.lveditor.draft');
    if (!fs.existsSync(capCutDrafts)) {
      return { error: 'Pasta de projetos do CapCut não encontrada.' };
    }

    if (!projectPaths || projectPaths.length < 2) {
      return { error: 'Selecione pelo menos 2 projetos para mesclar.' };
    }

    const timestamp = Date.now();
    const microTimestamp = timestamp * 1000 + Math.floor(Math.random() * 1000);

    // Sanitize project name - remove invalid Windows characters: \ / : * ? " < > |
    const sanitizeName = (name) => name.replace(/[\\/:*?"<>|]/g, '').trim() || `Merged_${timestamp}`;
    const projectName = sanitizeName(outputName || `Merged_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${timestamp}`);
    const projectPath = path.join(capCutDrafts, projectName);
    const newDraftId = generateUUID();

    // Check if already exists
    if (fs.existsSync(projectPath)) {
      return { error: 'Já existe um projeto com esse nome' };
    }

    // Create project folder
    fs.mkdirSync(projectPath, { recursive: true });

    // Read all source projects
    const sourceProjects = [];
    for (const srcPath of projectPaths) {
      const draftPath = path.join(srcPath, 'draft_content.json');
      if (!fs.existsSync(draftPath)) {
        return { error: `Projeto não encontrado: ${path.basename(srcPath)}` };
      }
      const content = JSON.parse(fs.readFileSync(draftPath, 'utf-8'));

      // Fix text content format - CapCut expects styles first, not text
      // When content starts with {"text":, CapCut wraps it in another {"text":} layer
      if (content.materials?.texts) {
        content.materials.texts = content.materials.texts.map(txt => {
          if (txt.content && typeof txt.content === 'string') {
            try {
              const parsed = JSON.parse(txt.content);
              // Reorder: styles first, then text, then other properties
              if (parsed.text && parsed.styles) {
                const reordered = {
                  styles: parsed.styles,
                  text: parsed.text
                };
                // Copy any other properties
                for (const key of Object.keys(parsed)) {
                  if (key !== 'styles' && key !== 'text') {
                    reordered[key] = parsed[key];
                  }
                }
                txt.content = JSON.stringify(reordered);
              }
            } catch (e) {
              // Keep original if can't parse
            }
          }
          return txt;
        });
      }

      sourceProjects.push({
        path: srcPath,
        name: path.basename(srcPath),
        content
      });
    }

    // Use first project as base for canvas config
    const baseProject = sourceProjects[0].content;

    // Create merged project structure
    const mergedProject = {
      canvas_config: baseProject.canvas_config || { height: 1080, width: 1920, ratio: 'original' },
      color_space: baseProject.color_space || 0,
      config: baseProject.config || {},
      cover: null,
      create_time: Math.floor(timestamp / 1000),
      draft_type: 'video',
      duration: 0,
      extra_info: null,
      fps: baseProject.fps || 30.0,
      free_render_index_mode_on: false,
      function_assistant_info: baseProject.function_assistant_info || {},
      group_container: null,
      id: newDraftId,
      is_drop_frame_timecode: false,
      keyframe_graph_list: [],
      keyframes: { adjusts: [], audios: [], effects: [], filters: [], handwrites: [], stickers: [], texts: [], videos: [] },
      last_modified_platform: baseProject.last_modified_platform || {},
      lyrics_effects: [],
      materials: {
        ai_translates: [], audio_balances: [], audio_effects: [], audio_fades: [],
        audio_pannings: [], audio_pitch_shifts: [], audio_track_indexes: [], audios: [],
        beats: [], canvases: [], chromas: [], color_curves: [], common_mask: [],
        digital_human_model_dressing: [], digital_humans: [], drafts: [], effects: [],
        filter_mask_infos: [], filters: [], green_screens: [], handwrites: [],
        hsl: [], images: [], log_color_wheels: [], loudnesses: [], manual_deformations: [],
        material_animations: [], material_colors: [], material_group_infos: [],
        multi_language_refs: [], placeholder_infos: [], plugin_contexts: [],
        primary_color_wheels: [], realtime_denoises: [], shape_masks: [], shapes: [],
        smart_crops: [], smart_relights: [], sound_channel_mappings: [], speeds: [],
        stickers: [], tail_leaders: [], text_templates: [], texts: [], time_marks: [],
        transitions: [], video_effects: [], video_trackings: [], videos: [],
        vocal_separations: []
      },
      mutable_config: null,
      name: projectName,
      new_version: '',
      platform: baseProject.platform || {},
      relationships: [],
      render_index_track_mode_on: false,
      retouch_cover: null,
      source: 'default',
      static_cover_image_path: '',
      tracks: mode === 'groups' ? [{ type: 'video', segments: [], attribute: 0, flag: 0, id: generateUUID() }] : [],
      update_time: Math.floor(timestamp / 1000),
      version: 360000
    };

    // ========== FLAT MODE: Merge all tracks directly ==========
    if (mode === 'flat') {
      let currentTimeOffset = 0;
      const idMapping = {}; // Map old IDs to new IDs

      for (const srcProject of sourceProjects) {
        const srcContent = srcProject.content;
        const projectDuration = srcContent.duration || 0;

        // Copy all materials with new IDs
        const materialTypes = [
          'videos', 'audios', 'texts', 'text_templates', 'effects', 'filters',
          'transitions', 'stickers', 'canvases', 'speeds', 'sound_channel_mappings',
          'vocal_separations', 'material_colors', 'placeholder_infos', 'beats',
          'audio_fades', 'audio_effects', 'loudnesses', 'material_animations'
        ];

        for (const matType of materialTypes) {
          if (srcContent.materials?.[matType]) {
            for (const mat of srcContent.materials[matType]) {
              const newId = generateUUID();
              idMapping[mat.id] = newId;
              const newMat = { ...mat, id: newId };
              if (!mergedProject.materials[matType]) {
                mergedProject.materials[matType] = [];
              }
              mergedProject.materials[matType].push(newMat);
            }
          }
        }

        // Copy and offset all tracks
        for (const srcTrack of (srcContent.tracks || [])) {
          // Find or create track of same type
          let targetTrack = mergedProject.tracks.find(t => t.type === srcTrack.type);
          if (!targetTrack) {
            targetTrack = {
              type: srcTrack.type,
              segments: [],
              attribute: srcTrack.attribute || 0,
              flag: srcTrack.flag || 0,
              id: generateUUID()
            };
            mergedProject.tracks.push(targetTrack);
          }

          // Copy segments with offset and mapped IDs
          for (const seg of (srcTrack.segments || [])) {
            const newSeg = JSON.parse(JSON.stringify(seg)); // Deep clone
            newSeg.id = generateUUID();

            // Offset timing
            if (newSeg.target_timerange) {
              newSeg.target_timerange.start = (newSeg.target_timerange.start || 0) + currentTimeOffset;
            }

            // Map material IDs
            if (newSeg.material_id && idMapping[newSeg.material_id]) {
              newSeg.material_id = idMapping[newSeg.material_id];
            }

            // Map extra_material_refs
            if (newSeg.extra_material_refs) {
              newSeg.extra_material_refs = newSeg.extra_material_refs.map(ref => idMapping[ref] || ref);
            }

            targetTrack.segments.push(newSeg);
          }
        }

        currentTimeOffset += projectDuration;
      }

      mergedProject.duration = currentTimeOffset;

      // Copy media files from each source project to merged project
      console.log('Copying media files from source projects...');
      let totalCopied = 0;
      for (const srcProject of sourceProjects) {
        // Copy all media files from source folder
        const copied = copyProjectMedia(srcProject.path, projectPath);
        totalCopied += copied;

        // Get the old placeholder ID from source project
        const oldPlaceholderId = extractPlaceholderId(srcProject.content);
        if (oldPlaceholderId) {
          console.log(`Replacing placeholders: ${oldPlaceholderId} -> ${newDraftId}`);
          // Update mergedProject with replaced placeholders
          const updatedContent = replacePlaceholders(mergedProject, oldPlaceholderId, newDraftId);
          Object.assign(mergedProject, updatedContent);
        }
      }
      console.log(`Total media files copied: ${totalCopied}`);

      // Save and register project (same as groups mode below)
      const draftPath = path.join(projectPath, 'draft_content.json');
      fs.writeFileSync(draftPath, JSON.stringify(mergedProject));

      // Create draft_info.json
      const draftInfo = {
        draft_cloud_capcut_purchase_info: null, draft_cloud_purchase_info: null, draft_cloud_template_id: '',
        draft_cloud_tutorial_info: null, draft_cloud_videocut_purchase_info: null, draft_cover: '', draft_deeplink_url: '',
        draft_enterprise_info: null, draft_fold_path: projectPath, draft_id: newDraftId, draft_is_ai_shorts: false,
        draft_is_article_video_draft: false, draft_is_from_deeplink: false, draft_is_invisible: false, draft_materials_copied: false,
        draft_materials_copied_path: null, draft_name: projectName, draft_new_version: '', draft_removable_storage_device: '',
        draft_root_path: capCutDrafts, draft_segment_extra_info: null, draft_timeline_materials_size: 0, draft_type: 'normal',
        tm_draft_cloud_completed: null, tm_draft_cloud_modified: 0, tm_draft_create: Math.floor(timestamp / 1000),
        tm_draft_modified: Math.floor(timestamp / 1000), tm_draft_removed: 0
      };
      fs.writeFileSync(path.join(projectPath, 'draft_info.json'), JSON.stringify(draftInfo, null, 2));

      // Create draft_meta_info.json
      const draftMetaInfo = {
        cloud_draft_cover: true, cloud_draft_sync: true, draft_cloud_last_action_download: false,
        draft_cloud_purchase_info: '', draft_cloud_template_id: '', draft_cloud_tutorial_info: '',
        draft_cloud_videocut_purchase_info: '', draft_cover: '',
        draft_enterprise_info: { draft_enterprise_extra: '', draft_enterprise_id: '', draft_enterprise_name: '', enterprise_material: [] },
        draft_fold_path: projectPath.replace(/\\/g, '/'), draft_id: newDraftId,
        draft_is_ai_shorts: false, draft_is_article_video_draft: false, draft_is_cloud_temp_draft: false,
        draft_is_from_deeplink: 'false', draft_is_invisible: false, draft_is_web_article_video: false,
        draft_materials: [
          { type: 0, value: [] }, { type: 1, value: [] }, { type: 2, value: [] },
          { type: 3, value: [] }, { type: 6, value: [] }, { type: 7, value: [] }, { type: 8, value: [] }
        ],
        draft_materials_copied_info: [], draft_name: projectName, draft_need_rename_folder: false,
        draft_new_version: '', draft_removable_storage_device: '',
        draft_root_path: capCutDrafts.replace(/\\/g, '/'), draft_segment_extra_info: [],
        draft_timeline_materials_size_: 0, draft_type: '',
        tm_draft_create: microTimestamp, tm_draft_modified: microTimestamp, tm_draft_removed: 0, tm_duration: currentTimeOffset
      };
      fs.writeFileSync(path.join(projectPath, 'draft_meta_info.json'), JSON.stringify(draftMetaInfo));

      // Register in root_meta_info.json
      const rootMetaPath = path.join(capCutDrafts, 'root_meta_info.json');
      let rootMeta = { all_draft_store: [], draft_ids: 0, root_path: capCutDrafts.replace(/\\/g, '/') };
      if (fs.existsSync(rootMetaPath)) {
        try { rootMeta = JSON.parse(fs.readFileSync(rootMetaPath, 'utf-8')); } catch (e) { console.error('Error reading root_meta_info:', e); }
      }

      const newDraftEntry = {
        cloud_draft_cover: true, cloud_draft_sync: true, draft_cloud_last_action_download: false,
        draft_cloud_purchase_info: '', draft_cloud_template_id: '', draft_cloud_tutorial_info: '',
        draft_cloud_videocut_purchase_info: '', draft_cover: '',
        draft_fold_path: projectPath.replace(/\\/g, '/'), draft_id: newDraftId,
        draft_is_ai_shorts: false, draft_is_cloud_temp_draft: false, draft_is_invisible: false,
        draft_is_web_article_video: false, draft_json_file: draftPath.replace(/\\/g, '/'),
        draft_name: projectName, draft_new_version: '', draft_root_path: capCutDrafts.replace(/\\/g, '/'),
        draft_timeline_materials_size: 0, draft_type: '', draft_web_article_video_enter_from: '',
        streaming_edit_draft_ready: true, tm_draft_cloud_completed: '', tm_draft_cloud_entry_id: -1,
        tm_draft_cloud_modified: 0, tm_draft_cloud_parent_entry_id: -1, tm_draft_cloud_space_id: -1,
        tm_draft_cloud_user_id: -1, tm_draft_create: microTimestamp, tm_draft_modified: microTimestamp,
        tm_draft_removed: 0, tm_duration: currentTimeOffset
      };

      rootMeta.all_draft_store.unshift(newDraftEntry);
      rootMeta.draft_ids = (rootMeta.draft_ids || 0) + 1;
      fs.writeFileSync(rootMetaPath, JSON.stringify(rootMeta));

      // Ensure all project files use consistent draft_id
      ensureConsistentDraftId(projectPath, capCutDrafts);

      return {
        success: true,
        path: projectPath,
        name: projectName,
        draftPath: draftPath,
        projectCount: sourceProjects.length,
        totalDuration: currentTimeOffset
      };
    }

    // ========== GROUPS MODE: Create composite clips ==========

    // Create subdraft folder for groups (like CapCut does manually)
    const subdraftFolder = path.join(projectPath, 'subdraft');
    fs.mkdirSync(subdraftFolder, { recursive: true });

    // Process each source project and convert to a group
    let currentTime = 0;
    let clipNumber = 1;

    for (const srcProject of sourceProjects) {
      const srcContent = srcProject.content;
      const projectDuration = srcContent.duration || 0;

      // Generate unique IDs
      const draftId = generateUUID();
      const subdraftId = generateUUID();
      const combinationId = generateUUID();
      const videoMaterialId = generateUUID();
      const segmentId = generateUUID();
      const canvasId = generateUUID();
      const speedId = generateUUID();
      const soundChannelId = generateUUID();
      const placeholderInfoId = generateUUID();
      const materialColorId = generateUUID();
      const vocalSeparationId = generateUUID();

      // Create subdraft folder and save draft content (like CapCut does)
      const subdraftPath = path.join(subdraftFolder, subdraftId);
      fs.mkdirSync(subdraftPath, { recursive: true });

      // Copy media files from source project folder to merged project folder
      console.log(`Copying media files for subdraft ${clipNumber}...`);
      const subdraftMediaCount = copyProjectMedia(srcProject.path, projectPath);
      console.log(`Subdraft ${clipNumber} media copy complete: ${subdraftMediaCount} files`);

      // Replace placeholders in srcContent to point to new project
      const oldPlaceholderId = extractPlaceholderId(srcContent);
      let updatedSrcContent = srcContent;
      if (oldPlaceholderId) {
        console.log(`Replacing placeholders in subdraft: ${oldPlaceholderId} -> ${newDraftId}`);
        updatedSrcContent = replacePlaceholders(srcContent, oldPlaceholderId, newDraftId);
      }

      fs.writeFileSync(path.join(subdraftPath, 'draft_content.json'), JSON.stringify(updatedSrcContent));

      // Create sub_draft_config.json
      const subDraftConfig = {
        draft_id: subdraftId,
        name: '',
        type: 'combination'
      };
      fs.writeFileSync(path.join(subdraftPath, 'sub_draft_config.json'), JSON.stringify(subDraftConfig));

      // Build draft_file_path like CapCut does (with placeholder)
      const draftFilePath = `##_draftpath_placeholder_${newDraftId}_##\\subdraft\\${subdraftId}\\draft_content.json`;

      // Create draft entry (the group content) - must match CapCut's expected structure
      const draftEntry = {
        aimusic_mv_template_info: null,
        category_id: '',
        category_name: '',
        combination_id: combinationId,
        combination_type: 'none',
        draft: updatedSrcContent,
        draft_config_path: '',
        draft_cover_path: '',
        draft_file_path: draftFilePath,
        formula_id: '',
        id: draftId,
        name: '',
        precompile_combination: false,
        type: 'combination'
      };
      mergedProject.materials.drafts.push(draftEntry);

      // Create canvas for this segment
      const canvasEntry = {
        album_image: '', blur: 0.0, color: '', id: canvasId,
        image: '', image_id: '', image_name: '', source_platform: 0, team_id: '', type: 'canvas_color'
      };
      mergedProject.materials.canvases.push(canvasEntry);

      // Create speed entry
      const speedEntry = {
        curve_speed: null, id: speedId, mode: 0, speed: 1.0, type: 'speed'
      };
      mergedProject.materials.speeds.push(speedEntry);

      // Create sound channel mapping
      const soundChannelEntry = {
        audio_channel_mapping: 0, id: soundChannelId, is_config_open: false, type: ''
      };
      mergedProject.materials.sound_channel_mappings.push(soundChannelEntry);

      // Create placeholder info
      const placeholderInfoEntry = {
        error_path: '', id: placeholderInfoId, meta_type: '', res_path: '', res_request_id: '', resource_id: '', source_from: '', source_platform: 0, team_id: '', type: 'placeholder_info'
      };
      mergedProject.materials.placeholder_infos.push(placeholderInfoEntry);

      // Create material color
      const materialColorEntry = {
        color_lut_path_list: [], color_model_lut_path_list: [], color_model_path: '', enable_skin_tone_restore: false, enable_smart: 0, formula_id: '', id: materialColorId, intensity: 1.0, path: '', skin_tone_restore_path: '', type: 'material_color'
      };
      mergedProject.materials.material_colors.push(materialColorEntry);

      // Create vocal separation
      const vocalSeparationEntry = {
        choice: 0, enter_from: '', final_algorithm: '', id: vocalSeparationId, production_path: '', removed_sounds: [], time_range: null, type: 'vocal_separation'
      };
      mergedProject.materials.vocal_separations.push(vocalSeparationEntry);

      // Create video material for the group (composite clip)
      const videoMaterial = {
        aigc_history_id: '', aigc_item_id: '', aigc_type: 'none',
        audio_fade: null, beauty_body_auto_preset: null, beauty_body_preset_id: '',
        beauty_face_auto_preset: { name: '', preset_id: '', rate_map: '', scene: '' },
        beauty_face_auto_preset_infos: [], beauty_face_preset_infos: [],
        cartoon_path: '', category_id: '', category_name: '', check_flag: 62978047,
        content_feature_info: null, corner_pin: null,
        crop: { lower_left_x: 0, lower_left_y: 1, lower_right_x: 1, lower_right_y: 1, upper_left_x: 0, upper_left_y: 0, upper_right_x: 1, upper_right_y: 0 },
        crop_ratio: 'free', crop_scale: 1,
        duration: projectDuration,
        extra_type_option: 2,  // KEY: This marks it as a composite clip/group
        formula_id: '', freeze: null,
        has_audio: true, has_sound_separated: false,
        height: srcContent.canvas_config?.height || 1080,
        id: videoMaterialId,
        intensifies_audio_path: '', intensifies_path: '',
        is_ai_generate_content: false, is_copyright: false, is_text_edit_overdub: false,
        is_unified_beauty_mode: false, live_photo_cover_path: '', live_photo_timestamp: -1,
        local_id: '', local_material_from: '', local_material_id: '',
        material_id: '',
        material_name: `Clipe composto${clipNumber}`,  // Name shown in CapCut
        material_url: '',
        matting: { custom_matting_id: '', enable_matting_stroke: false, expansion: 0, feather: 0, flag: 0, has_use_quick_brush: false, has_use_quick_eraser: false, interactiveTime: [], path: '', reverse: false, strokes: [] },
        media_path: '', multi_camera_info: null, object_locked: null, origin_material_id: '',
        path: '',  // KEY: Empty path indicates it's a group
        picture_from: 'none', picture_set_category_id: '', picture_set_category_name: '',
        request_id: '', reverse_intensifies_path: '', reverse_path: '',
        smart_match_info: null, smart_motion: null, source: 0, source_platform: 0,
        stable: { matrix_path: '', stable_level: 0, time_range: { duration: 0, start: 0 } },
        team_id: '', type: 'video',
        video_algorithm: { ai_background_configs: [], algorithms: [], path: '', time_range: null },
        width: srcContent.canvas_config?.width || 1920
      };
      mergedProject.materials.videos.push(videoMaterial);

      // Create segment referencing the group
      const segment = {
        caption_info: null,
        cartoon: false,
        clip: { alpha: 1, flip: { horizontal: false, vertical: false }, rotation: 0, scale: { x: 1, y: 1 }, transform: { x: 0, y: 0 } },
        common_keyframes: [],
        enable_adjust: true,
        enable_color_correct_adjust: false,
        enable_color_curves: true,
        enable_color_match_adjust: false,
        enable_color_wheels: true,
        enable_lut: true,
        enable_smart_color_adjust: false,
        extra_material_refs: [
          draftId,           // Reference to the draft entry (group content)
          speedId,           // Speed control
          placeholderInfoId, // Placeholder info
          canvasId,          // Canvas/background
          soundChannelId,    // Sound channel mapping
          materialColorId,   // Material color
          vocalSeparationId  // Vocal separation
        ],
        group_id: '',
        hdr_settings: { intensity: 1, mode: 1, nits: 1000 },
        id: segmentId,
        intensifies_audio: false,
        is_placeholder: false,
        is_tone_modify: false,
        keyframe_refs: [],
        last_nonzero_volume: 1,
        material_id: videoMaterialId,
        render_index: 0,
        responsive_layout: { enable: false, horizontal_pos_layout: 0, size_layout: 0, target_follow: '', vertical_pos_layout: 0 },
        reverse: false,
        source_timerange: { duration: projectDuration, start: 0 },
        speed: 1,
        state: 0,
        target_timerange: { duration: projectDuration, start: currentTime },
        template_id: '',
        template_scene: 'default',
        track_attribute: 0,
        track_render_index: 0,
        uniform_scale: { on: true, value: 1 },
        visible: true,
        volume: 1
      };
      mergedProject.tracks[0].segments.push(segment);

      currentTime += projectDuration;
      clipNumber++;
    }

    // Set total duration
    mergedProject.duration = currentTime;

    // Debug: log drafts count
    console.log('Merge: Total drafts created:', mergedProject.materials.drafts.length);
    console.log('Merge: Total videos created:', mergedProject.materials.videos.length);

    // DEBUG: Check content before save
    if (mergedProject.materials.drafts[0]?.draft?.materials?.texts?.[0]?.content) {
      console.log('DEBUG MERGE - Before save, draft[0] texts[0].content first 60:', mergedProject.materials.drafts[0].draft.materials.texts[0].content.substring(0, 60));
    }

    // Save draft_content.json
    const draftPath = path.join(projectPath, 'draft_content.json');
    const jsonString = JSON.stringify(mergedProject);
    console.log('Merge: JSON size:', jsonString.length, 'bytes');
    fs.writeFileSync(draftPath, jsonString);

    // Create draft_info.json
    const draftInfo = {
      draft_cloud_capcut_purchase_info: null, draft_cloud_purchase_info: null, draft_cloud_template_id: '',
      draft_cloud_tutorial_info: null, draft_cloud_videocut_purchase_info: null, draft_cover: '', draft_deeplink_url: '',
      draft_enterprise_info: null, draft_fold_path: projectPath, draft_id: newDraftId, draft_is_ai_shorts: false,
      draft_is_article_video_draft: false, draft_is_from_deeplink: false, draft_is_invisible: false, draft_materials_copied: false,
      draft_materials_copied_path: null, draft_name: projectName, draft_new_version: '', draft_removable_storage_device: '',
      draft_root_path: capCutDrafts, draft_segment_extra_info: null, draft_timeline_materials_size: 0, draft_type: 'normal',
      tm_draft_cloud_completed: null, tm_draft_cloud_modified: 0, tm_draft_create: Math.floor(timestamp / 1000),
      tm_draft_modified: Math.floor(timestamp / 1000), tm_draft_removed: 0
    };
    fs.writeFileSync(path.join(projectPath, 'draft_info.json'), JSON.stringify(draftInfo, null, 2));

    // Create draft_meta_info.json
    const draftMetaInfo = {
      cloud_draft_cover: true, cloud_draft_sync: true, draft_cloud_last_action_download: false,
      draft_cloud_purchase_info: '', draft_cloud_template_id: '', draft_cloud_tutorial_info: '',
      draft_cloud_videocut_purchase_info: '', draft_cover: '',
      draft_enterprise_info: { draft_enterprise_extra: '', draft_enterprise_id: '', draft_enterprise_name: '', enterprise_material: [] },
      draft_fold_path: projectPath.replace(/\\/g, '/'), draft_id: newDraftId,
      draft_is_ai_shorts: false, draft_is_article_video_draft: false, draft_is_cloud_temp_draft: false,
      draft_is_from_deeplink: 'false', draft_is_invisible: false, draft_is_web_article_video: false,
      draft_materials: [
        { type: 0, value: [] }, { type: 1, value: [] }, { type: 2, value: [] },
        { type: 3, value: [] }, { type: 6, value: [] }, { type: 7, value: [] }, { type: 8, value: [] }
      ],
      draft_materials_copied_info: [], draft_name: projectName, draft_need_rename_folder: false,
      draft_new_version: '', draft_removable_storage_device: '',
      draft_root_path: capCutDrafts.replace(/\\/g, '/'), draft_segment_extra_info: [],
      draft_timeline_materials_size_: 0, draft_type: '',
      tm_draft_create: microTimestamp, tm_draft_modified: microTimestamp, tm_draft_removed: 0, tm_duration: currentTime
    };
    fs.writeFileSync(path.join(projectPath, 'draft_meta_info.json'), JSON.stringify(draftMetaInfo));

    // Register in root_meta_info.json
    const rootMetaPath = path.join(capCutDrafts, 'root_meta_info.json');
    let rootMeta = { all_draft_store: [], draft_ids: 0, root_path: capCutDrafts.replace(/\\/g, '/') };
    if (fs.existsSync(rootMetaPath)) {
      try { rootMeta = JSON.parse(fs.readFileSync(rootMetaPath, 'utf-8')); } catch (e) { console.error('Error reading root_meta_info:', e); }
    }

    const newDraftEntry = {
      cloud_draft_cover: true, cloud_draft_sync: true, draft_cloud_last_action_download: false,
      draft_cloud_purchase_info: '', draft_cloud_template_id: '', draft_cloud_tutorial_info: '',
      draft_cloud_videocut_purchase_info: '', draft_cover: '',
      draft_fold_path: projectPath.replace(/\\/g, '/'), draft_id: newDraftId,
      draft_is_ai_shorts: false, draft_is_cloud_temp_draft: false, draft_is_invisible: false,
      draft_is_web_article_video: false, draft_json_file: draftPath.replace(/\\/g, '/'),
      draft_name: projectName, draft_new_version: '', draft_root_path: capCutDrafts.replace(/\\/g, '/'),
      draft_timeline_materials_size: 0, draft_type: '', draft_web_article_video_enter_from: '',
      streaming_edit_draft_ready: true, tm_draft_cloud_completed: '', tm_draft_cloud_entry_id: -1,
      tm_draft_cloud_modified: 0, tm_draft_cloud_parent_entry_id: -1, tm_draft_cloud_space_id: -1,
      tm_draft_cloud_user_id: -1, tm_draft_create: microTimestamp, tm_draft_modified: microTimestamp,
      tm_draft_removed: 0, tm_duration: currentTime
    };

    rootMeta.all_draft_store.unshift(newDraftEntry);
    rootMeta.draft_ids = (rootMeta.draft_ids || 0) + 1;
    fs.writeFileSync(rootMetaPath, JSON.stringify(rootMeta));

    // Ensure all project files use consistent draft_id
    ensureConsistentDraftId(projectPath, capCutDrafts);

    return {
      success: true,
      path: projectPath,
      name: projectName,
      draftPath: draftPath,
      projectCount: sourceProjects.length,
      totalDuration: currentTime
    };
  } catch (error) {
    console.error('Error merging projects:', error);
    return { error: error.message };
  }
});

// ========== DEBUG ANALYZE FUNCTION ==========
// Debug function to see what's in a project
ipcMain.handle('debug-analyze-project', async (_, { projectPath }) => {
  console.log('\n=== ANALYZE PROJECT ===');
  console.log('Path:', projectPath);

  try {
    const draftPath = path.join(projectPath, 'draft_content.json');
    if (!fs.existsSync(draftPath)) {
      return { error: 'Projeto não encontrado.' };
    }

    const content = JSON.parse(fs.readFileSync(draftPath, 'utf-8'));
    const analysis = {
      hasTexts: false,
      textCount: 0,
      texts: [],
      hasDrafts: false,
      draftCount: 0,
      hasSubdrafts: false,
      subdraftCount: 0
    };

    // Analyze main texts
    if (content.materials?.texts?.length > 0) {
      analysis.hasTexts = true;
      analysis.textCount = content.materials.texts.length;
      content.materials.texts.forEach((txt, idx) => {
        const textInfo = {
          index: idx,
          hasContent: !!txt.content,
          contentType: typeof txt.content,
          contentPreview: txt.content?.substring(0, 200) || 'N/A',
          isJson: false,
          parsedKeys: []
        };
        if (txt.content) {
          try {
            const parsed = JSON.parse(txt.content);
            textInfo.isJson = true;
            textInfo.parsedKeys = Object.keys(parsed);
            if (parsed.text) {
              textInfo.textValue = parsed.text.substring(0, 100);
            }
          } catch (e) {
            textInfo.isJson = false;
          }
        }
        analysis.texts.push(textInfo);
      });
    }

    // Analyze drafts (groups)
    if (content.materials?.drafts?.length > 0) {
      analysis.hasDrafts = true;
      analysis.draftCount = content.materials.drafts.length;
    }

    // Analyze subdrafts
    const subdraftFolder = path.join(projectPath, 'subdraft');
    if (fs.existsSync(subdraftFolder)) {
      const subdrafts = fs.readdirSync(subdraftFolder);
      analysis.hasSubdrafts = true;
      analysis.subdraftCount = subdrafts.length;
    }

    console.log('Analysis:', JSON.stringify(analysis, null, 2));
    return { success: true, analysis };
  } catch (error) {
    console.error('Error analyzing project:', error);
    return { error: error.message };
  }
});

// ========== CLEAN SUBTITLES FUNCTION ==========
// Fixes subtitle content that displays as JSON instead of plain text
ipcMain.handle('clean-subtitles', async (_, { projectPath }) => {
  console.log('\n=== CLEAN SUBTITLES CALLED ===');
  console.log('Project path:', projectPath);

  try {
    const draftPath = path.join(projectPath, 'draft_content.json');
    console.log('Draft path:', draftPath);

    if (!fs.existsSync(draftPath)) {
      console.log('ERROR: File not found');
      return { error: 'Projeto não encontrado.' };
    }

    // Create backup
    const backupPath = path.join(projectPath, `draft_content_backup_${Date.now()}.json`);
    fs.copyFileSync(draftPath, backupPath);
    console.log('Backup created:', backupPath);

    const content = JSON.parse(fs.readFileSync(draftPath, 'utf-8'));
    let cleanedCount = 0;
    const logs = [];

    // Process text materials
    console.log('Checking materials.texts...');
    console.log('texts exists?', !!content.materials?.texts);
    console.log('texts length:', content.materials?.texts?.length || 0);

    if (content.materials?.texts && content.materials.texts.length > 0) {
      logs.push(`Encontrados ${content.materials.texts.length} textos`);

      content.materials.texts = content.materials.texts.map((txt, idx) => {
        console.log(`\n--- Processing text ${idx} ---`);
        console.log('Content exists?', !!txt.content);
        console.log('Content type:', typeof txt.content);
        console.log('Content (first 150 chars):', txt.content?.substring(0, 150));

        if (txt.content && typeof txt.content === 'string') {
          try {
            const parsed = JSON.parse(txt.content);
            console.log('Parsed successfully, keys:', Object.keys(parsed));

            // Check if it has the expected structure with text field
            if (parsed.text !== undefined) {
              const plainText = typeof parsed.text === 'string' ? parsed.text : String(parsed.text);
              console.log('Text field found:', plainText.substring(0, 80));

              // Check if the text itself is another JSON string (double wrapped)
              let finalText = plainText;
              let innerStyles = null;
              try {
                const innerParsed = JSON.parse(plainText);
                if (innerParsed.text !== undefined) {
                  finalText = innerParsed.text;
                  innerStyles = innerParsed.styles; // Get styles from inner JSON if exists
                  console.log('Double-wrapped! Inner text:', finalText.substring(0, 80));
                }
              } catch (e) {
                // Not double wrapped, use as-is
              }

              // Create clean content PRESERVING STYLES
              // Use inner styles if found, otherwise use outer styles
              const stylesToKeep = innerStyles || parsed.styles;
              const cleanedContent = {
                styles: stylesToKeep,
                text: finalText
              };
              // Copy any other properties from original (like check_flag, etc)
              for (const key of Object.keys(parsed)) {
                if (key !== 'styles' && key !== 'text') {
                  cleanedContent[key] = parsed[key];
                }
              }
              txt.content = JSON.stringify(cleanedContent);
              cleanedCount++;
              logs.push(`[${idx}] "${finalText.substring(0, 40)}..."`);
              console.log(`CLEANED (with styles): "${finalText.substring(0, 50)}"`);
            } else {
              console.log('No text field in parsed content');
              logs.push(`[${idx}] Sem campo text`);
            }
          } catch (e) {
            console.log('Not JSON, keeping original:', e.message);
            logs.push(`[${idx}] Não é JSON`);
          }
        } else {
          console.log('No content or not string');
        }
        return txt;
      });
    } else {
      logs.push('Nenhum texto em materials.texts');
      console.log('No texts found in materials.texts');
    }

    // Also clean texts in subdrafts if they exist
    const subdraftFolder = path.join(projectPath, 'subdraft');
    if (fs.existsSync(subdraftFolder)) {
      const subdrafts = fs.readdirSync(subdraftFolder);
      for (const subdraftId of subdrafts) {
        const subdraftDraftPath = path.join(subdraftFolder, subdraftId, 'draft_content.json');
        if (fs.existsSync(subdraftDraftPath)) {
          try {
            const subdraftContent = JSON.parse(fs.readFileSync(subdraftDraftPath, 'utf-8'));
            if (subdraftContent.materials?.texts) {
              subdraftContent.materials.texts = subdraftContent.materials.texts.map(txt => {
                if (txt.content && typeof txt.content === 'string') {
                  try {
                    const parsed = JSON.parse(txt.content);
                    if (parsed.text !== undefined) {
                      const plainText = typeof parsed.text === 'string' ? parsed.text : String(parsed.text);
                      let finalText = plainText;
                      let innerStyles = null;
                      try {
                        const innerParsed = JSON.parse(plainText);
                        if (innerParsed.text !== undefined) {
                          finalText = innerParsed.text;
                          innerStyles = innerParsed.styles;
                        }
                      } catch (e) {}
                      // PRESERVE STYLES
                      const stylesToKeep = innerStyles || parsed.styles;
                      const cleanedContent = { styles: stylesToKeep, text: finalText };
                      for (const key of Object.keys(parsed)) {
                        if (key !== 'styles' && key !== 'text') cleanedContent[key] = parsed[key];
                      }
                      txt.content = JSON.stringify(cleanedContent);
                      cleanedCount++;
                      console.log(`Cleaned subdraft text (with styles): "${finalText.substring(0, 50)}..."`);
                    }
                  } catch (e) {}
                }
                return txt;
              });
              fs.writeFileSync(subdraftDraftPath, JSON.stringify(subdraftContent));
            }
          } catch (e) {
            console.error(`Error processing subdraft ${subdraftId}:`, e);
          }
        }
      }
    }

    // Also update drafts array if it exists (for groups mode)
    if (content.materials?.drafts) {
      content.materials.drafts = content.materials.drafts.map(draft => {
        if (draft.draft?.materials?.texts) {
          draft.draft.materials.texts = draft.draft.materials.texts.map(txt => {
            if (txt.content && typeof txt.content === 'string') {
              try {
                const parsed = JSON.parse(txt.content);
                if (parsed.text !== undefined) {
                  const plainText = typeof parsed.text === 'string' ? parsed.text : String(parsed.text);
                  let finalText = plainText;
                  let innerStyles = null;
                  try {
                    const innerParsed = JSON.parse(plainText);
                    if (innerParsed.text !== undefined) {
                      finalText = innerParsed.text;
                      innerStyles = innerParsed.styles;
                    }
                  } catch (e) {}
                  // PRESERVE STYLES
                  const stylesToKeep = innerStyles || parsed.styles;
                  const cleanedContent = { styles: stylesToKeep, text: finalText };
                  for (const key of Object.keys(parsed)) {
                    if (key !== 'styles' && key !== 'text') cleanedContent[key] = parsed[key];
                  }
                  txt.content = JSON.stringify(cleanedContent);
                  cleanedCount++;
                }
              } catch (e) {}
            }
            return txt;
          });
        }
        return draft;
      });
    }

    fs.writeFileSync(draftPath, JSON.stringify(content));
    console.log('\n=== CLEAN COMPLETE ===');
    console.log('Cleaned count:', cleanedCount);
    console.log('Logs:', logs);

    return {
      success: true,
      cleanedCount,
      backupPath,
      logs,
      message: cleanedCount > 0
        ? `${cleanedCount} legendas limpas. Backup salvo.`
        : 'Nenhuma legenda para limpar (0 textos encontrados)'
    };
  } catch (error) {
    console.error('Error cleaning subtitles:', error);
    return { error: error.message };
  }
});

// ============ PROJECT EXPORT/IMPORT ============
// Helper function to run project_manager.py
function runProjectManager(params) {
  return new Promise((resolve) => {
    const basePath = app.isPackaged
      ? process.resourcesPath
      : process.cwd();
    const pythonScript = path.join(basePath, 'python', 'project_manager.py');
    const tempFile = path.join(app.getPath('temp'), `project_cmd_${Date.now()}.json`);

    fs.writeFileSync(tempFile, JSON.stringify(params));

    const pythonProcess = spawn('python', [pythonScript, '--file', tempFile], {
      encoding: 'utf-8'
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { stderr += data.toString(); });

    pythonProcess.on('close', (code) => {
      try { fs.unlinkSync(tempFile); } catch {}

      if (code === 0 && stdout) {
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch {
          resolve({ success: false, error: 'Failed to parse response' });
        }
      } else {
        resolve({ success: false, error: stderr || 'Process failed' });
      }
    });
  });
}

// Export project to ZIP
ipcMain.handle('export-project', async (_, { draftPath }) => {
  console.log('[Export] Iniciando export para:', draftPath);
  try {
    // Pegar nome do projeto
    const projectName = path.basename(path.dirname(draftPath));
    console.log('[Export] Nome do projeto:', projectName);

    // Pegar janela ativa
    const parentWindow = mainWindow || BrowserWindow.getFocusedWindow();
    console.log('[Export] Janela disponivel:', !!parentWindow);

    const dialogOptions = {
      title: 'Salvar Projeto Exportado',
      defaultPath: path.join(app.getPath('desktop'), `${projectName}_export.zip`),
      filters: [{ name: 'Arquivo ZIP', extensions: ['zip'] }],
      buttonLabel: 'Exportar'
    };

    // Mostrar dialog de salvar
    const result = await dialog.showSaveDialog(parentWindow, dialogOptions);
    console.log('[Export] Resultado do dialog:', result);

    if (result.canceled || !result.filePath) {
      console.log('[Export] Usuario cancelou');
      return { success: false, canceled: true };
    }

    console.log('[Export] Salvando em:', result.filePath);
    return runProjectManager({
      action: 'export',
      draftPath: path.dirname(draftPath),
      outputPath: result.filePath
    });
  } catch (error) {
    console.error('[Export] Erro:', error);
    return { success: false, error: error.message };
  }
});

// Import project from ZIP
ipcMain.handle('import-project', async () => {
  console.log('[Import] Iniciando importacao...');
  try {
    // Pegar janela ativa
    const parentWindow = mainWindow || BrowserWindow.getFocusedWindow();

    // Abrir dialog para selecionar ZIP
    const fileResult = await dialog.showOpenDialog(parentWindow, {
      title: 'Selecionar Projeto para Importar',
      filters: [{ name: 'Arquivo ZIP', extensions: ['zip'] }],
      properties: ['openFile'],
      buttonLabel: 'Importar'
    });

    if (fileResult.canceled || !fileResult.filePaths.length) {
      console.log('[Import] Usuario cancelou');
      return { success: false, canceled: true };
    }

    const zipPath = fileResult.filePaths[0];
    console.log('[Import] ZIP selecionado:', zipPath);

    // Pasta de projetos do CapCut
    const capCutDrafts = path.join(app.getPath('appData'), '..', 'Local', 'CapCut', 'User Data', 'Projects', 'com.lveditor.draft');
    const rootMetaPath = path.join(capCutDrafts, 'root_meta_info.json');

    if (!fs.existsSync(capCutDrafts)) {
      return { success: false, error: 'Pasta de projetos do CapCut nao encontrada' };
    }

    console.log('[Import] Pasta CapCut:', capCutDrafts);

    // Chamar Python para importar
    const result = await runProjectManager({
      action: 'import',
      zipPath,
      outputDir: capCutDrafts,
      rootMetaPath
    });

    console.log('[Import] Resultado:', result);
    return result;
  } catch (error) {
    console.error('[Import] Erro:', error);
    return { success: false, error: error.message };
  }
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
