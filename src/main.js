const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const url = require('node:url');
const { execSync, spawn } = require('node:child_process');

// App version
const APP_VERSION = '2.0.0';
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
    // Se o comando for muito grande (>7000 chars), usar arquivo temporário
    if (cmdJson.length > 7000) {
      const tempDir = require('os').tmpdir();
      const tempFile = path.join(tempDir, `capcut_cmd_${Date.now()}.json`);
      fs.writeFileSync(tempFile, cmdJson, 'utf-8');
      console.log('[Python] Using temp file:', tempFile);

      const result = execSync(`python "${pythonScript}" --file "${tempFile}"`, {
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024 // 50MB
      });

      // Limpar arquivo temporário
      try { fs.unlinkSync(tempFile); } catch {}

      return JSON.parse(result);
    } else {
      const result = execSync(`python "${pythonScript}" "${cmdJson.replace(/"/g, '\\"')}"`, {
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024 // 50MB
      });
      return JSON.parse(result);
    }
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

ipcMain.handle('create-new-project', async () => {
  try {
    const capCutDrafts = path.join(app.getPath('appData'), '..', 'Local', 'CapCut', 'User Data', 'Projects', 'com.lveditor.draft');
    if (!fs.existsSync(capCutDrafts)) {
      return { error: 'Pasta de projetos do CapCut nao encontrada. Abra o CapCut primeiro.' };
    }

    const timestamp = Date.now();
    const microTimestamp = timestamp * 1000 + Math.floor(Math.random() * 1000);
    const projectName = `SyncPro_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${timestamp}`;
    const projectPath = path.join(capCutDrafts, projectName);
    const draftId = generateUUID();

    fs.mkdirSync(projectPath, { recursive: true });

    const draftContent = {
      canvas_config: { height: 1920, width: 1080, ratio: "original" },
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
ipcMain.handle('insert-srt', async (_, { draftPath, srtFolders, createTitle, selectedFiles }) => {
  // selectedFiles now contains full paths (srtPath), not just filenames
  // srtFolders is an array of all scanned folders
  return runPython({ action: 'insert_srt', draftPath, srtFolders, createTitle, selectedFilePaths: selectedFiles });
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

// ============ INSERT MEDIA BATCH (video/image) ============
ipcMain.handle('run-python', async (_, command) => {
  return runPython(command);
});

// ============ BACKUP / UNDO SYSTEM (Multi-level) ============

// List all backups for a project
ipcMain.handle('list-backups', async (_, draftPath) => {
  try {
    const dir = path.dirname(draftPath);
    const baseName = path.basename(draftPath, '.json');
    const files = fs.readdirSync(dir);

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
        if (match) {
          const dateStr = match[1]; // 20251220
          const timeStr = match[2]; // 123456
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
          size: stats.size
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp); // Most recent first

    return { backups, count: backups.length };
  } catch (error) {
    return { backups: [], count: 0, error: error.message };
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
ipcMain.handle('detect-capcut-folder', async () => {
  try {
    const os = require('node:os');
    const homeDir = os.homedir();

    // Caminho padrão do CapCut no Windows
    const capCutPath = path.join(homeDir, 'AppData', 'Local', 'CapCut', 'User Data', 'Projects', 'com.lveditor.draft');

    if (!fs.existsSync(capCutPath)) {
      return { error: 'Pasta do CapCut não encontrada no caminho padrão' };
    }

    // Listar projetos (pastas que contêm draft_content.json)
    const items = fs.readdirSync(capCutPath);
    const projects = [];

    for (const item of items) {
      const itemPath = path.join(capCutPath, item);
      const draftPath = path.join(itemPath, 'draft_content.json');

      if (fs.statSync(itemPath).isDirectory() && fs.existsSync(draftPath)) {
        // Pegar data de modificação
        const stats = fs.statSync(draftPath);
        projects.push({
          name: item,
          path: itemPath,
          draftPath: draftPath,
          modifiedAt: stats.mtime.toISOString(),
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
