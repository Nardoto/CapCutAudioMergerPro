import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, FolderOpen, Upload, BookOpen, Check, X, AlertTriangle, Music, Eye, RefreshCw, Plus, Layers, Wand2, Type } from 'lucide-react'
import type { LogEntry } from '../../types'
import ConfirmSaveDialog from '../ConfirmSaveDialog'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

interface SrtMatch {
  srtFile: string
  srtPath: string
  audioName?: string
  baseName: string
  subtitleCount: number
  matched: boolean
  selected?: boolean
  durationMs?: number  // For batch mode
}

interface SrtPanelProps {
  onLog: (type: LogEntry['type'], message: string) => void
  draftPath: string | null
  onReanalyze?: () => void
}

export default function SrtPanel({ onLog, draftPath, onReanalyze }: SrtPanelProps) {
  const [srtFolder, setSrtFolder] = useState<string | null>(null)
  const [srtFolders, setSrtFolders] = useState<string[]>([])  // All scanned folders
  const [createTitle, setCreateTitle] = useState(true)
  const [separateTracks, setSeparateTracks] = useState(false)  // Create separate track for each audio
  const [isProcessing, setIsProcessing] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [matches, setMatches] = useState<SrtMatch[]>([])
  const [unmatched, setUnmatched] = useState<SrtMatch[]>([])
  const [scanStats, setScanStats] = useState<{ totalSrt: number; totalAudios: number; matchedCount: number } | null>(null)

  // Mode: 'audio' | 'batch' | 'create'
  const [mode, setMode] = useState<'audio' | 'batch' | 'create'>('audio')

  // Batch mode - insert SRTs sequentially without audio reference
  const [batchFiles, setBatchFiles] = useState<SrtMatch[]>([])
  const [showBatchPreview, setShowBatchPreview] = useState(false)
  const [gapSeconds, setGapSeconds] = useState(2)  // Gap between each SRT in seconds

  // Create mode - generate SRT from script
  const [scriptText, setScriptText] = useState('')
  const [maxChars, setMaxChars] = useState(490)
  const [readingRate, setReadingRate] = useState(10)  // characters per second
  const [srtFileName, setSrtFileName] = useState('')

  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingBlocks, setPendingBlocks] = useState<string[]>([])
  const [pendingDuration, setPendingDuration] = useState('')

  const handleSelectFolder = async () => {
    if (!ipcRenderer) {
      onLog('error', 'Electron IPC não disponível')
      return
    }

    onLog('info', 'Selecionando pasta de legendas...')

    try {
      const result = await ipcRenderer.invoke('select-srt-folder')
      if (!result) {
        onLog('warning', 'Seleção cancelada')
        return
      }
      if (result.error) {
        onLog('error', result.error)
        return
      }
      setSrtFolder(result.path)
      setSrtFolders([result.path])  // Reset folders list
      onLog('success', `Pasta selecionada: ${result.name} (${result.srtCount} arquivos .srt)`)

      // Auto-scan if project is loaded
      if (draftPath) {
        await scanMatches(result.path)
      }
    } catch (error) {
      onLog('error', 'Erro: ' + error)
    }
  }

  // Add another folder without closing preview (accumulates subtitles)
  const handleAddFolder = async () => {
    if (!ipcRenderer) {
      onLog('error', 'Electron IPC não disponível')
      return
    }

    onLog('info', 'Adicionando pasta de legendas...')

    try {
      const result = await ipcRenderer.invoke('select-srt-folder')
      if (!result) {
        onLog('warning', 'Seleção cancelada')
        return
      }
      if (result.error) {
        onLog('error', result.error)
        return
      }

      // Add to folders list (avoid duplicates)
      setSrtFolders(prev => {
        if (prev.includes(result.path)) return prev
        return [...prev, result.path]
      })
      onLog('info', `Adicionando: ${result.name} (${result.srtCount} arquivos .srt)`)

      // Scan with append mode
      if (draftPath) {
        await scanMatches(result.path, true)
      }
    } catch (error) {
      onLog('error', 'Erro: ' + error)
    }
  }

  const scanMatches = async (folder: string, append: boolean = false) => {
    if (!draftPath || !ipcRenderer) return

    setIsScanning(true)
    onLog('info', append ? 'Adicionando legendas...' : 'Escaneando correspondências...')

    try {
      const result = await ipcRenderer.invoke('scan-srt-matches', { srtFolder: folder, draftPath })
      if (result.error) {
        onLog('error', result.error)
        return
      }

      // Mark all matched as selected by default
      const matchedWithSelection = result.matches.map((m: SrtMatch) => ({ ...m, selected: true }))
      const unmatchedWithSelection = result.unmatched.map((m: SrtMatch) => ({ ...m, selected: false }))

      if (append) {
        // Somar às existentes (evitando duplicatas por srtFile)
        setMatches(prev => {
          const existingFiles = new Set(prev.map(p => p.srtFile))
          const newMatches = matchedWithSelection.filter((m: SrtMatch) => !existingFiles.has(m.srtFile))
          return [...prev, ...newMatches]
        })
        setUnmatched(prev => {
          const existingFiles = new Set(prev.map(p => p.srtFile))
          const newUnmatched = unmatchedWithSelection.filter((m: SrtMatch) => !existingFiles.has(m.srtFile))
          return [...prev, ...newUnmatched]
        })
        setScanStats(prev => prev ? {
          totalSrt: prev.totalSrt + result.totalSrt,
          totalAudios: result.totalAudios,
          matchedCount: prev.matchedCount + result.matchedCount
        } : {
          totalSrt: result.totalSrt,
          totalAudios: result.totalAudios,
          matchedCount: result.matchedCount
        })
        onLog('success', `+${result.matchedCount} legendas adicionadas`)
      } else {
        setMatches(matchedWithSelection)
        setUnmatched(unmatchedWithSelection)
        setScanStats({
          totalSrt: result.totalSrt,
          totalAudios: result.totalAudios,
          matchedCount: result.matchedCount
        })
        onLog('success', `${result.matchedCount}/${result.totalSrt} legendas correspondem aos áudios do projeto`)
      }

      setShowPreview(true)
    } catch (error) {
      onLog('error', 'Erro ao escanear: ' + error)
    } finally {
      setIsScanning(false)
    }
  }

  const toggleSelection = (index: number, isMatched: boolean) => {
    if (isMatched) {
      setMatches(prev => prev.map((m, i) => i === index ? { ...m, selected: !m.selected } : m))
    } else {
      setUnmatched(prev => prev.map((m, i) => i === index ? { ...m, selected: !m.selected } : m))
    }
  }

  const selectAll = (isMatched: boolean) => {
    if (isMatched) {
      setMatches(prev => prev.map(m => ({ ...m, selected: true })))
    } else {
      setUnmatched(prev => prev.map(m => ({ ...m, selected: true })))
    }
  }

  const deselectAll = (isMatched: boolean) => {
    if (isMatched) {
      setMatches(prev => prev.map(m => ({ ...m, selected: false })))
    } else {
      setUnmatched(prev => prev.map(m => ({ ...m, selected: false })))
    }
  }

  const selectedCount = matches.filter(m => m.selected).length + unmatched.filter(m => m.selected).length
  const totalSubtitles = [...matches, ...unmatched].filter(m => m.selected).reduce((sum, m) => sum + m.subtitleCount, 0)

  const handleInsertSubtitles = async () => {
    if (srtFolders.length === 0 || !draftPath || !ipcRenderer) return

    const selectedItems = [...matches, ...unmatched].filter(m => m.selected)
    if (selectedItems.length === 0) {
      onLog('warning', 'Selecione pelo menos uma legenda para inserir!')
      return
    }

    // Extrair os caminhos COMPLETOS dos arquivos selecionados
    const selectedFilePaths = selectedItems.map(m => m.srtPath)

    setIsProcessing(true)
    setShowPreview(false)
    onLog('info', `Inserindo ${selectedItems.length} legendas na timeline...`)

    try {
      const result = await ipcRenderer.invoke('insert-srt', {
        draftPath,
        srtFolders,  // Pass all folders
        createTitle,
        selectedFiles: selectedFilePaths,  // Pass full paths
        separateTracks,  // Whether to create separate track per audio
      })

      if (result.error) {
        onLog('error', result.error)
      } else {
        result.logs?.forEach((log: string) => onLog('info', log))
        onLog('success', `Legendas inseridas! ${result.stats.totalSubtitles} segmentos em ${result.stats.tracksCreated} track(s)`)

        // Save backup description
        await ipcRenderer.invoke('save-backup-description', { draftPath, description: 'SRT inserido' })

        // Desmarcar os arquivos que foram inseridos e atualizar a lista
        setMatches(prev => prev.map(m => selectedItems.some(s => s.srtFile === m.srtFile) ? { ...m, selected: false } : m))
        setUnmatched(prev => prev.map(m => selectedItems.some(s => s.srtFile === m.srtFile) ? { ...m, selected: false } : m))

        onReanalyze?.()
      }
    } catch (error) {
      onLog('error', 'Erro: ' + error)
    }

    setIsProcessing(false)
  }

  // Rescan para adicionar mais legendas
  const handleRescan = async () => {
    if (srtFolder && draftPath) {
      await scanMatches(srtFolder)
    }
  }

  // ============ BATCH MODE FUNCTIONS ============

  // Select folder for batch mode (no audio matching)
  const handleSelectBatchFolder = async () => {
    if (!ipcRenderer) {
      onLog('error', 'Electron IPC não disponível')
      return
    }

    onLog('info', 'Selecionando pasta para inserção em massa...')

    try {
      const result = await ipcRenderer.invoke('select-srt-folder')
      if (!result) {
        onLog('warning', 'Seleção cancelada')
        return
      }
      if (result.error) {
        onLog('error', result.error)
        return
      }

      setSrtFolder(result.path)
      setSrtFolders([result.path])
      onLog('success', `Pasta selecionada: ${result.name} (${result.srtCount} arquivos .srt)`)

      // Scan SRTs for batch mode (no audio matching needed)
      await scanBatchFiles(result.path)
    } catch (error) {
      onLog('error', 'Erro: ' + error)
    }
  }

  // Scan SRT files for batch mode
  const scanBatchFiles = async (folder: string, append: boolean = false) => {
    if (!ipcRenderer) return

    setIsScanning(true)
    onLog('info', append ? 'Adicionando legendas...' : 'Escaneando arquivos SRT...')

    try {
      const result = await ipcRenderer.invoke('scan-srt-batch', { srtFolder: folder })
      if (result.error) {
        onLog('error', result.error)
        return
      }

      const filesWithSelection = result.files.map((f: SrtMatch) => ({ ...f, selected: true }))

      if (append) {
        setBatchFiles(prev => {
          const existingFiles = new Set(prev.map(p => p.srtFile))
          const newFiles = filesWithSelection.filter((f: SrtMatch) => !existingFiles.has(f.srtFile))
          return [...prev, ...newFiles]
        })
        onLog('success', `+${result.files.length} arquivos adicionados`)
      } else {
        setBatchFiles(filesWithSelection)
        onLog('success', `${result.files.length} arquivos SRT encontrados`)
      }

      setShowBatchPreview(true)
    } catch (error) {
      onLog('error', 'Erro ao escanear: ' + error)
    } finally {
      setIsScanning(false)
    }
  }

  // Add more files to batch
  const handleAddBatchFolder = async () => {
    if (!ipcRenderer) return

    try {
      const result = await ipcRenderer.invoke('select-srt-folder')
      if (!result) return
      if (result.error) {
        onLog('error', result.error)
        return
      }

      setSrtFolders(prev => prev.includes(result.path) ? prev : [...prev, result.path])
      await scanBatchFiles(result.path, true)
    } catch (error) {
      onLog('error', 'Erro: ' + error)
    }
  }

  // Toggle batch file selection
  const toggleBatchSelection = (index: number) => {
    setBatchFiles(prev => prev.map((f, i) => i === index ? { ...f, selected: !f.selected } : f))
  }

  // Insert batch subtitles sequentially
  const handleInsertBatch = async () => {
    if (!draftPath || !ipcRenderer) return

    const selectedFiles = batchFiles.filter(f => f.selected)
    if (selectedFiles.length === 0) {
      onLog('warning', 'Selecione pelo menos uma legenda!')
      return
    }

    setIsProcessing(true)
    setShowBatchPreview(false)
    onLog('info', `Inserindo ${selectedFiles.length} legendas em sequência...`)

    try {
      const result = await ipcRenderer.invoke('insert-srt-batch', {
        draftPath,
        srtFiles: selectedFiles.map(f => f.srtPath),
        createTitle: false,  // No title for batch mode - title option only for audio mode
        gapMs: gapSeconds * 1000000,  // Convert seconds to microseconds
      })

      if (result.error) {
        onLog('error', result.error)
      } else {
        result.logs?.forEach((log: string) => onLog('info', log))
        onLog('success', `Inserido! ${result.stats.totalSubtitles} segmentos, duração total: ${formatDuration(result.stats.totalDuration)}`)
        // Save backup description
        await ipcRenderer.invoke('save-backup-description', { draftPath, description: 'SRT em massa' })
        setBatchFiles(prev => prev.map(f => selectedFiles.some(s => s.srtPath === f.srtPath) ? { ...f, selected: false } : f))
        onReanalyze?.()
      }
    } catch (error) {
      onLog('error', 'Erro: ' + error)
    }

    setIsProcessing(false)
  }

  // ========================================
  // CREATE SRT FROM SCRIPT
  // ========================================

  // Abbreviations that shouldn't end a sentence
  const ABBREVIATIONS = new Set([
    'sr', 'sra', 'srta', 'dr', 'dra', 'prof', 'profa', 'eng', 'adv', 'av',
    'etc', 'ex', 'obs', 'pág', 'vol', 'cap', 'ed', 'num', 'tel', 'cel',
    'ltda', 'cia', 'sa', 'gov', 'min', 'sec', 'dep', 'sen', 'pres', 'dir',
    'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez',
    'mr', 'mrs', 'ms', 'jr', 'vs', 'inc', 'ltd', 'co', 'corp'
  ])

  // Format text for TTS
  const formatText = (text: string) => {
    return text
      .replace(/["«»„""]/g, "'")
      .replace(/['']/g, "'")
      .replace(/[—–]/g, " - ")
      .replace(/\.{3,}/g, "...")
      .replace(/…/g, "...")
      .replace(/\n/g, " ")
      .replace(/\s+([.,!?;:])/g, "$1")
      .replace(/([.,!?;:])([a-zA-ZáàâãéèêíìîóòôõúùûñçÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÑÇ])/g, "$1 $2")
      .replace(/\s+/g, ' ')
      .trim()
  }

  // Check if word is an abbreviation
  const isAbbreviation = (word: string) => {
    if (!word) return false
    const cleaned = word.toLowerCase().replace(/[.,!?;:]+$/, '').replace(/\./g, '')
    return ABBREVIATIONS.has(cleaned)
  }

  // Split text into sentences
  const splitIntoSentences = (text: string) => {
    const sentences: string[] = []
    let currentSentence = ''
    let i = 0

    while (i < text.length) {
      const char = text[i]
      currentSentence += char

      if (/[.!?]/.test(char)) {
        let j = i + 1
        while (j < text.length && /[.!?]/.test(text[j])) {
          currentSentence += text[j]
          j++
        }

        let whitespace = ''
        while (j < text.length && /\s/.test(text[j])) {
          whitespace += text[j]
          j++
        }

        const wordsBefore = currentSentence.trim().split(/\s+/)
        const lastWord = wordsBefore[wordsBefore.length - 1]
        const nextChar = text[j]

        const isRealBreak =
          !isAbbreviation(lastWord) &&
          !(nextChar && /[a-záàâãéèêíìîóòôõúùûñç\d]/.test(nextChar)) &&
          whitespace.length > 0

        if (isRealBreak && currentSentence.trim().length > 0) {
          sentences.push(currentSentence.trim())
          currentSentence = ''
          i = j - 1
        }
      }
      i++
    }

    if (currentSentence.trim()) {
      sentences.push(currentSentence.trim())
    }

    return sentences.length > 0 ? sentences : [text]
  }

  // Find best cut point in text (simplified and more robust)
  const findBestCutPoint = (text: string, maxLength: number): number => {
    if (text.length <= maxLength) return text.length

    const maxWithTolerance = Math.floor(maxLength * 1.15)
    const searchText = text.substring(0, maxWithTolerance)

    // Priority 1: Find last sentence ending (.!?) before max
    const sentenceMatches = [...searchText.matchAll(/[.!?]+\s+/g)]
    for (let i = sentenceMatches.length - 1; i >= 0; i--) {
      const pos = sentenceMatches[i].index! + sentenceMatches[i][0].length
      if (pos <= maxWithTolerance && pos >= maxLength * 0.4) {
        return pos
      }
    }

    // Priority 2: Find last comma before max
    const commaMatches = [...searchText.matchAll(/,\s+/g)]
    for (let i = commaMatches.length - 1; i >= 0; i--) {
      const pos = commaMatches[i].index! + commaMatches[i][0].length
      if (pos <= maxWithTolerance && pos >= maxLength * 0.3) {
        return pos
      }
    }

    // Priority 3: Find last space before max
    const lastSpace = searchText.lastIndexOf(' ')
    if (lastSpace > maxLength * 0.3) {
      return lastSpace + 1
    }

    // Fallback: cut at max
    return maxLength
  }

  // Divide text into blocks (simplified algorithm)
  const divideTextIntoBlocks = (text: string, maxLength: number): string[] => {
    const formatted = formatText(text)
    if (!formatted) return []

    const blocks: string[] = []
    let remaining = formatted

    while (remaining.length > 0) {
      remaining = remaining.trim()
      if (!remaining) break

      if (remaining.length <= maxLength) {
        // Last block - add it all
        blocks.push(remaining)
        break
      }

      // Find best cut point
      const cutPoint = findBestCutPoint(remaining, maxLength)
      const block = remaining.substring(0, cutPoint).trim()

      if (block) {
        blocks.push(block)
      }

      remaining = remaining.substring(cutPoint).trim()
    }

    return blocks.filter(b => b.length > 0)
  }

  // Format timestamp for SRT
  const formatSrtTimestamp = (totalSeconds: number) => {
    let hours = Math.floor(totalSeconds / 3600)
    let minutes = Math.floor((totalSeconds % 3600) / 60)
    let seconds = Math.floor(totalSeconds % 60)
    let milliseconds = Math.round((totalSeconds - Math.floor(totalSeconds)) * 1000)

    // Handle milliseconds overflow (1000 -> 0, increment second)
    if (milliseconds >= 1000) {
      milliseconds = 0
      seconds += 1
      if (seconds >= 60) {
        seconds = 0
        minutes += 1
        if (minutes >= 60) {
          minutes = 0
          hours += 1
        }
      }
    }

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`
  }

  // Generate SRT content
  const generateSrtContent = (blocks: string[], rate: number, includeTitle: boolean, title: string) => {
    const PAUSE_TIME = 0.9 // seconds between blocks
    let srtContent = ''
    let currentTime = 0
    let index = 1

    // Add title block if requested
    if (includeTitle && title) {
      const titleDuration = title.length / rate
      srtContent += `${index}\n${formatSrtTimestamp(currentTime)} --> ${formatSrtTimestamp(currentTime + titleDuration)}\n${title}\n\n`
      currentTime += titleDuration + PAUSE_TIME
      index++
    }

    for (const block of blocks) {
      const duration = block.length / rate
      const startTime = currentTime
      const endTime = currentTime + duration

      srtContent += `${index}\n${formatSrtTimestamp(startTime)} --> ${formatSrtTimestamp(endTime)}\n${block}\n\n`

      currentTime = endTime + PAUSE_TIME
      index++
    }

    return srtContent.trim()
  }

  // Calculate duration from blocks
  const calculateDuration = (blocks: string[], rate: number, includeTitle: boolean, title: string) => {
    const PAUSE_TIME = 0.9
    let totalSeconds = 0

    if (includeTitle && title) {
      totalSeconds += title.length / rate + PAUSE_TIME
    }

    for (const block of blocks) {
      totalSeconds += block.length / rate + PAUSE_TIME
    }

    const mins = Math.floor(totalSeconds / 60)
    const secs = Math.floor(totalSeconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Prepare SRT - check CapCut first, only show dialog if open
  const handlePrepareCreateSrt = async () => {
    if (!scriptText.trim() || !ipcRenderer) return

    // Divide text into blocks
    const blocks = divideTextIntoBlocks(scriptText, maxChars)
    const fileName = srtFileName.trim() || 'roteiro'
    const duration = calculateDuration(blocks, readingRate, createTitle, fileName)

    // Check if CapCut is running
    try {
      const result = await ipcRenderer.invoke('check-capcut-running')

      if (result.isRunning) {
        // CapCut is open - show confirmation dialog
        setPendingBlocks(blocks)
        setPendingDuration(duration)
        setShowConfirmDialog(true)
      } else {
        // CapCut is closed - proceed directly
        setPendingBlocks(blocks)
        setPendingDuration(duration)
        await executeCreateSrt(blocks, duration)
      }
    } catch {
      // If check fails, proceed directly
      setPendingBlocks(blocks)
      setPendingDuration(duration)
      await executeCreateSrt(blocks, duration)
    }
  }

  // Actually create and insert SRT
  const executeCreateSrt = async (blocks: string[], duration: string) => {
    if (!draftPath || !ipcRenderer || blocks.length === 0) return

    setIsProcessing(true)
    onLog('info', 'Gerando SRT...')

    try {
      // Generate SRT content (no title for create mode - title option is only for audio mode)
      const fileName = srtFileName.trim() || 'roteiro'
      const srtContent = generateSrtContent(blocks, readingRate, false, fileName)

      onLog('info', `${blocks.length} blocos, duração: ${duration}`)

      // Call main process to save and insert
      const result = await ipcRenderer.invoke('create-and-insert-srt', {
        draftPath,
        srtContent,
        fileName,
        createTitle: false,  // No title for create mode
      })

      if (result.error) {
        onLog('error', result.error)
      } else {
        onLog('success', `SRT criado: ${result.srtPath}`)
        onLog('success', `Inserido! ${result.stats.totalSubtitles} segmentos na timeline`)

        // Save backup description
        await ipcRenderer.invoke('save-backup-description', { draftPath, description: 'SRT criado de roteiro' })

        // Clear the form
        setScriptText('')
        setSrtFileName('')
        setPendingBlocks([])

        onReanalyze?.()
      }
    } catch (error) {
      onLog('error', 'Erro: ' + error)
    }

    setIsProcessing(false)
  }

  // Called from confirmation dialog when user confirms
  const handleConfirmCreateSrt = async () => {
    setShowConfirmDialog(false)
    await executeCreateSrt(pendingBlocks, pendingDuration)
  }

  // Helper to format duration
  const formatDuration = (ms: number) => {
    const totalSec = Math.floor(ms / 1000000)
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    return `${min}:${sec.toString().padStart(2, '0')}`
  }

  const batchSelectedCount = batchFiles.filter(f => f.selected).length
  const batchTotalSubtitles = batchFiles.filter(f => f.selected).reduce((sum, f) => sum + f.subtitleCount, 0)

  const hasProject = !!draftPath

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary/40 to-primary/10">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Legendas SRT</h2>
          <p className="text-sm text-text-secondary">Insere arquivos .srt na timeline</p>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
        <button
          onClick={() => setMode('audio')}
          className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1 ${
            mode === 'audio' ? 'bg-white/10 text-white' : 'text-text-muted hover:text-white'
          }`}
        >
          <Music className="w-3.5 h-3.5" />
          Com Áudio
        </button>
        <button
          onClick={() => setMode('batch')}
          className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1 ${
            mode === 'batch' ? 'bg-white/10 text-white' : 'text-text-muted hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Em Massa
        </button>
        <button
          onClick={() => setMode('create')}
          className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1 ${
            mode === 'create' ? 'bg-white/10 text-white' : 'text-text-muted hover:text-white'
          }`}
        >
          <Wand2 className="w-3.5 h-3.5" />
          Criar SRT
        </button>
      </div>

      {/* Warning if no project */}
      {!hasProject && (
        <div className="p-3 rounded-xl bg-yellow-500/10 text-sm text-yellow-400">
          Selecione e analise um projeto primeiro na aba SYNC
        </div>
      )}

      {/* ============ AUDIO MODE ============ */}
      {mode === 'audio' && (
        <>
          {/* Folder Selection */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              <FolderOpen className="w-4 h-4" />
              PASTA DAS LEGENDAS
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                value={srtFolder || ''}
                readOnly
                placeholder="Selecione a pasta com arquivos .srt"
                className="flex-1 bg-background-dark text-white text-xs px-3 py-2 rounded-lg outline-none cursor-pointer hover:bg-white/5 transition-colors"
                onClick={handleSelectFolder}
              />
              <button
                onClick={handleSelectFolder}
                disabled={isScanning}
                className="px-3 py-2 bg-background-dark hover:bg-white/10 text-white rounded-lg transition-colors"
                title="Selecionar pasta"
              >
                {isScanning ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <FolderOpen className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

      {/* Scan Stats */}
      {scanStats && (
        <div className="p-3 rounded-xl bg-background-dark-alt/50 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-white font-medium">{scanStats.totalSrt}</span>
                <span className="text-text-muted">SRTs</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Music className="w-4 h-4 text-blue-400" />
                <span className="text-white font-medium">{scanStats.totalAudios}</span>
                <span className="text-text-muted">áudios</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-green-400" />
                <span className="text-green-400 font-medium">{scanStats.matchedCount}</span>
                <span className="text-text-muted">matches</span>
              </div>
            </div>
            <button
              onClick={() => setShowPreview(true)}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Eye className="w-3 h-3" />
              Ver detalhes
            </button>
          </div>
          {/* Botões de ação */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleRescan}
              disabled={isScanning}
              className="flex-1 py-1.5 px-3 text-xs bg-background-dark hover:bg-white/10 text-white rounded-lg flex items-center justify-center gap-1.5 transition-colors"
              title="Re-escanear a pasta atual"
            >
              <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
              Re-escanear
            </button>
            <button
              onClick={handleSelectFolder}
              disabled={isScanning}
              className="flex-1 py-1.5 px-3 text-xs bg-background-dark hover:bg-white/10 text-white rounded-lg flex items-center justify-center gap-1.5 transition-colors"
              title="Selecionar outra pasta de legendas"
            >
              <Plus className="w-3 h-3" />
              Outra pasta
            </button>
          </div>
        </div>
      )}

      {/* Options */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-text-secondary">OPÇÕES</label>
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={createTitle}
            onChange={(e) => setCreateTitle(e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded border-border-light bg-white/5 focus:ring-offset-0 accent-primary"
          />
          <Music className="w-4 h-4 mt-0.5 text-text-muted transition-colors" />
          <div>
            <span className="text-sm text-text-primary block">Inserir nome da música</span>
            <span className="text-[10px] text-text-muted">Adiciona o nome do arquivo SRT (título da música) como texto na timeline</span>
          </div>
        </label>

        {/* Separate tracks option - only show when 2+ audios selected */}
        {selectedCount >= 2 && (
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={separateTracks}
              onChange={(e) => setSeparateTracks(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-border-light bg-white/5 focus:ring-offset-0 accent-primary"
            />
            <Layers className="w-4 h-4 mt-0.5 text-text-muted transition-colors" />
            <div>
              <span className="text-sm text-text-primary block">Tracks separadas por áudio</span>
              <span className="text-[10px] text-text-muted">Cria uma track de legenda individual para cada áudio (ao invés de uma única track)</span>
            </div>
          </label>
        )}
      </div>

      {/* Action Button */}
      <button
        onClick={handleInsertSubtitles}
        disabled={!srtFolder || !hasProject || isProcessing || selectedCount === 0}
        className={`
          w-full py-2.5 rounded-lg font-bold text-white text-sm transition-all flex items-center justify-center gap-2
          ${!srtFolder || !hasProject || isProcessing || selectedCount === 0
            ? 'bg-gray-600 cursor-not-allowed'
            : 'bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-primary/25'
          }
        `}
      >
        {isProcessing ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Inserindo...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            INSERIR {selectedCount > 0 ? `${selectedCount} LEGENDAS (~${totalSubtitles} segs)` : 'LEGENDAS'}
          </>
        )}
      </button>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 z-50"
              onClick={() => setShowPreview(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-4 top-16 bottom-16 md:inset-x-16 bg-background-dark rounded-xl z-50 flex flex-col overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-3 bg-background-dark-alt/50 flex-shrink-0">
                <div>
                  <h2 className="text-sm font-bold text-white">Prévia das Legendas</h2>
                  <p className="text-[10px] text-text-muted">
                    {selectedCount}/{matches.length + unmatched.length} selecionadas • ~{totalSubtitles} segs
                  </p>
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-text-secondary" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto p-3 space-y-3">
                {/* Matched Section */}
                {matches.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-green-400" />
                        <span className="text-xs font-semibold text-white">
                          Correspondências ({matches.length})
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => selectAll(true)} className="text-[10px] text-primary hover:underline">
                          Todos
                        </button>
                        <button onClick={() => deselectAll(true)} className="text-[10px] text-text-muted hover:underline">
                          Nenhum
                        </button>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      {matches.map((m, i) => (
                        <div
                          key={m.srtPath}
                          onClick={() => toggleSelection(i, true)}
                          className={`py-1 px-2 rounded cursor-pointer transition-all ${
                            m.selected
                              ? 'bg-green-500/15'
                              : 'bg-white/5 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={m.selected}
                                onChange={() => {}}
                                className="w-3 h-3"
                                style={{ accentColor: '#22c55e' }}
                              />
                              <span className="text-[11px] text-white truncate max-w-[280px]">{m.baseName}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-text-muted flex-shrink-0">
                              <span>{m.subtitleCount}</span>
                              <Music className="w-2.5 h-2.5 text-green-400" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unmatched Section */}
                {unmatched.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                        <span className="text-xs font-semibold text-white">
                          Sem correspondência ({unmatched.length})
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => selectAll(false)} className="text-[10px] text-primary hover:underline">
                          Todos
                        </button>
                        <button onClick={() => deselectAll(false)} className="text-[10px] text-text-muted hover:underline">
                          Nenhum
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-text-muted">
                      Não correspondem a nenhum áudio do projeto
                    </p>
                    <div className="space-y-0.5">
                      {unmatched.map((m, i) => (
                        <div
                          key={m.srtPath}
                          onClick={() => toggleSelection(i, false)}
                          className={`py-1 px-2 rounded cursor-pointer transition-all ${
                            m.selected
                              ? 'bg-yellow-500/15'
                              : 'bg-white/5 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={m.selected}
                                onChange={() => {}}
                                className="w-3 h-3"
                                style={{ accentColor: '#eab308' }}
                              />
                              <span className="text-[11px] text-white truncate max-w-[280px]">{m.baseName}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-text-muted flex-shrink-0">
                              <span>{m.subtitleCount}</span>
                              <AlertTriangle className="w-2.5 h-2.5 text-yellow-400" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 bg-background-dark-alt/50 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAddFolder}
                    disabled={isScanning}
                    className="py-1.5 px-3 text-xs bg-background-dark hover:bg-white/10 text-white rounded-lg flex items-center gap-1.5 transition-colors"
                    title="Adicionar legendas de outra pasta"
                  >
                    {isScanning ? (
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    Adicionar pasta
                  </button>
                  <span className="text-[10px] text-text-muted">
                    {selectedCount > 0 ? (
                      <span className="text-green-400">{selectedCount} selecionados • ~{totalSubtitles} segs</span>
                    ) : (
                      <span>Nenhum selecionado</span>
                    )}
                  </span>
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  className="py-1.5 px-4 text-xs bg-primary hover:bg-primary/80 text-white font-semibold rounded-lg transition-colors"
                >
                  OK
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
        </>
      )}

      {/* ============ BATCH MODE ============ */}
      {mode === 'batch' && (
        <>
          {/* Folder Selection */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              <FolderOpen className="w-4 h-4" />
              PASTA DAS LEGENDAS
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                value={srtFolder || ''}
                readOnly
                placeholder="Selecione a pasta com arquivos .srt"
                className="flex-1 bg-background-dark text-white text-xs px-3 py-2 rounded-lg outline-none cursor-pointer hover:bg-white/5 transition-colors"
                onClick={handleSelectBatchFolder}
              />
              <button
                onClick={handleSelectBatchFolder}
                disabled={isScanning}
                className="px-3 py-2 bg-background-dark hover:bg-white/10 text-white rounded-lg transition-colors"
                title="Selecionar pasta"
              >
                {isScanning ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <FolderOpen className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Batch Stats */}
          {batchFiles.length > 0 && (
            <div className="p-3 rounded-xl bg-background-dark-alt/50 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="text-white font-medium">{batchFiles.length}</span>
                    <span className="text-text-muted">arquivos</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-green-400 font-medium">{batchSelectedCount}</span>
                    <span className="text-text-muted">selecionados</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowBatchPreview(true)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" />
                  Ver detalhes
                </button>
              </div>
            </div>
          )}

          {/* Gap Configuration */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              ESPAÇO ENTRE LEGENDAS
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={gapSeconds}
                onChange={(e) => setGapSeconds(parseFloat(e.target.value))}
                className="flex-1 accent-primary"
              />
              <span className="text-sm text-white font-medium w-12 text-center">
                {gapSeconds}s
              </span>
            </div>
            <p className="text-[10px] text-text-muted">
              Espaço entre cada bloco de legenda para diferenciar os áudios
            </p>
          </div>

          {/* Action Button */}
          <button
            onClick={handleInsertBatch}
            disabled={!hasProject || isProcessing || batchSelectedCount === 0}
            className={`
              w-full py-2.5 rounded-lg font-bold text-white text-sm transition-all flex items-center justify-center gap-2
              ${!hasProject || isProcessing || batchSelectedCount === 0
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-primary/25'
              }
            `}
          >
            {isProcessing ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Inserindo...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                INSERIR {batchSelectedCount > 0 ? `${batchSelectedCount} LEGENDAS (~${batchTotalSubtitles} segs)` : 'LEGENDAS'}
              </>
            )}
          </button>

          {/* Batch Preview Modal */}
          <AnimatePresence>
            {showBatchPreview && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/70 z-50"
                  onClick={() => setShowBatchPreview(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="fixed inset-x-4 top-16 bottom-16 md:inset-x-16 bg-background-dark rounded-xl z-50 flex flex-col overflow-hidden shadow-2xl"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between p-3 bg-background-dark-alt/50 flex-shrink-0">
                    <div>
                      <h2 className="text-sm font-bold text-white">Inserção em Massa</h2>
                      <p className="text-[10px] text-text-muted">
                        {batchSelectedCount}/{batchFiles.length} selecionados • ~{batchTotalSubtitles} segs • gap: {gapSeconds}s
                      </p>
                    </div>
                    <button
                      onClick={() => setShowBatchPreview(false)}
                      className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4 text-text-secondary" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-auto p-3 space-y-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-white">
                        Arquivos SRT ({batchFiles.length})
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setBatchFiles(prev => prev.map(f => ({ ...f, selected: true })))}
                          className="text-[10px] text-primary hover:underline"
                        >
                          Todos
                        </button>
                        <button
                          onClick={() => setBatchFiles(prev => prev.map(f => ({ ...f, selected: false })))}
                          className="text-[10px] text-text-muted hover:underline"
                        >
                          Nenhum
                        </button>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      {batchFiles.map((f, i) => (
                        <div
                          key={f.srtPath}
                          onClick={() => toggleBatchSelection(i)}
                          className={`py-1 px-2 rounded cursor-pointer transition-all ${
                            f.selected
                              ? 'bg-green-500/15'
                              : 'bg-white/5 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={f.selected}
                                onChange={() => {}}
                                className="w-3 h-3"
                                style={{ accentColor: '#22c55e' }}
                              />
                              <span className="text-[11px] text-white truncate max-w-[280px]">{f.baseName}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-text-muted flex-shrink-0">
                              <span>{f.subtitleCount} segs</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="p-3 bg-background-dark-alt/50 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAddBatchFolder}
                        disabled={isScanning}
                        className="py-1.5 px-3 text-xs bg-background-dark hover:bg-white/10 text-white rounded-lg flex items-center gap-1.5 transition-colors"
                        title="Adicionar mais arquivos"
                      >
                        {isScanning ? (
                          <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        Adicionar pasta
                      </button>
                      <span className="text-[10px] text-text-muted">
                        {batchSelectedCount > 0 ? (
                          <span className="text-green-400">{batchSelectedCount} selecionados</span>
                        ) : (
                          <span>Nenhum selecionado</span>
                        )}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowBatchPreview(false)}
                      className="py-1.5 px-4 text-xs bg-primary hover:bg-primary/80 text-white font-semibold rounded-lg transition-colors"
                    >
                      OK
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}

      {/* ============ CREATE MODE ============ */}
      {mode === 'create' && (
        <>
          {/* File Name */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              <FileText className="w-4 h-4" />
              NOME DO ARQUIVO
            </label>
            <input
              type="text"
              value={srtFileName}
              onChange={(e) => setSrtFileName(e.target.value)}
              placeholder="Ex: meu_video"
              className="w-full bg-background-dark text-white text-xs px-3 py-2 rounded-lg outline-none hover:bg-white/5 transition-colors"
            />
          </div>

          {/* Script Input */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              <Type className="w-4 h-4" />
              ROTEIRO
            </label>
            <textarea
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              placeholder="Cole aqui o roteiro completo. O texto será dividido automaticamente em blocos respeitando pontuações..."
              rows={8}
              className="w-full bg-background-dark text-white text-xs px-3 py-2 rounded-lg outline-none hover:bg-white/5 transition-colors resize-y min-h-[120px]"
            />
            {scriptText && (
              <div className="text-[10px] text-text-muted">
                {scriptText.length} caracteres | ~{Math.ceil(scriptText.length / maxChars)} blocos
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="p-3 rounded-xl bg-background-dark-alt/50 space-y-3">
            <div className="flex items-center gap-4">
              {/* Max Characters */}
              <div className="flex-1">
                <label className="text-[10px] text-text-muted mb-1 block">Máx. caracteres/bloco</label>
                <input
                  type="number"
                  value={maxChars}
                  onChange={(e) => setMaxChars(Math.max(100, parseInt(e.target.value) || 490))}
                  min={100}
                  max={1000}
                  className="w-full bg-background-dark text-white text-xs px-2 py-1.5 rounded outline-none hover:bg-white/5 transition-colors"
                />
              </div>

              {/* Reading Rate */}
              <div className="flex-1">
                <label className="text-[10px] text-text-muted mb-1 block">Velocidade (c/s)</label>
                <input
                  type="number"
                  value={readingRate}
                  onChange={(e) => setReadingRate(Math.max(5, Math.min(30, parseInt(e.target.value) || 10)))}
                  min={5}
                  max={30}
                  className="w-full bg-background-dark text-white text-xs px-2 py-1.5 rounded outline-none hover:bg-white/5 transition-colors"
                />
              </div>
            </div>

            <p className="text-[10px] text-text-muted">
              Velocidade controla a duração de cada legenda. Menor = mais lento de ler.
            </p>
          </div>

          {/* Action Button */}
          <button
            onClick={handlePrepareCreateSrt}
            disabled={!hasProject || isProcessing || !scriptText.trim()}
            className={`
              w-full py-2.5 rounded-lg font-bold text-white text-sm transition-all flex items-center justify-center gap-2
              ${!hasProject || isProcessing || !scriptText.trim()
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-primary/25'
              }
            `}
          >
            {isProcessing ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                GERAR SRT E INSERIR
              </>
            )}
          </button>
        </>
      )}

      {/* Confirmation Dialog */}
      <ConfirmSaveDialog
        isOpen={showConfirmDialog}
        onConfirm={handleConfirmCreateSrt}
        onCancel={() => {
          setShowConfirmDialog(false)
          setPendingBlocks([])
        }}
        title="Confirmar Criação de SRT"
        summary={`${pendingBlocks.length} legendas serão inseridas na timeline`}
        details={pendingBlocks}
        itemCount={pendingBlocks.length}
        duration={pendingDuration}
      />
    </div>
  )
}
