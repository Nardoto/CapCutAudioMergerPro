import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Layers, FolderOpen, Check, ChevronUp, ChevronDown, Trash2, Play, Clock, AlertCircle, RefreshCw, Sparkles, Cloud } from 'lucide-react'
import type { LogEntry } from '../../types'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

interface ProjectInfo {
  path: string
  name: string
  duration: number
  selected: boolean
}

interface MergePanelProps {
  onLog: (type: LogEntry['type'], message: string) => void
  onProjectChange?: () => void
  currentProjectPath?: string | null
}

// Format duration in MM:SS (CapCut uses microseconds: 1 second = 1,000,000)
function formatDuration(microseconds: number): string {
  const seconds = Math.floor(microseconds / 1000000)
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Colors for timeline preview
const TIMELINE_COLORS = [
  '#E85A2A', // Orange (primary)
  '#3B82F6', // Blue
  '#22C55E', // Green
  '#A855F7', // Purple
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#EF4444', // Red
]

export default function MergePanel({ onLog, onProjectChange, currentProjectPath }: MergePanelProps) {
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [selectedProjects, setSelectedProjects] = useState<ProjectInfo[]>([])
  const [outputName, setOutputName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isMerging, setIsMerging] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [lastMergedName, setLastMergedName] = useState('')
  const [customPath, setCustomPath] = useState<string | null>(() => {
    try { return localStorage.getItem('capcut_merge_custom_folder') } catch { return null }
  })
  const [mergeMode, setMergeMode] = useState<'groups' | 'flat'>('flat') // 'groups' = composite clips, 'flat' = direct merge
  const [lastMergedPath, setLastMergedPath] = useState<string | null>(null)
  const [isCleaning, setIsCleaning] = useState(false)
  const [projectSource, setProjectSource] = useState<'local' | 'custom'>('local')
  const [customProjects, setCustomProjects] = useState<ProjectInfo[]>([])

  // Load local projects on mount
  useEffect(() => {
    loadLocalProjects()
  }, [])

  // Load local projects (default CapCut folder)
  const loadLocalProjects = async () => {
    if (!ipcRenderer) return
    setIsLoading(true)

    try {
      const result = await ipcRenderer.invoke('detect-capcut-folder', {})
      if (result.projects && Array.isArray(result.projects)) {
        const projectList: ProjectInfo[] = result.projects.map((p: { path: string; name: string; duration?: number }) => ({
          path: p.path,
          name: p.name,
          duration: p.duration || 0,
          selected: false
        }))
        setProjects(projectList)
      }
    } catch (error) {
      onLog('error', 'Erro ao carregar projetos locais')
    } finally {
      setIsLoading(false)
    }
  }

  // Load custom folder projects
  const loadCustomProjects = async (folderPath?: string) => {
    if (!ipcRenderer) return
    const targetPath = folderPath || customPath
    if (!targetPath) return

    setIsLoading(true)

    try {
      const result = await ipcRenderer.invoke('detect-capcut-folder', { customPath: targetPath })
      if (result.projects && Array.isArray(result.projects)) {
        const projectList: ProjectInfo[] = result.projects.map((p: { path: string; name: string; duration?: number }) => ({
          path: p.path,
          name: p.name,
          duration: p.duration || 0,
          selected: false
        }))
        setCustomProjects(projectList)
      } else if (result.error) {
        onLog('error', result.error)
        setCustomProjects([])
      }
    } catch (error) {
      onLog('error', 'Erro ao carregar projetos da pasta')
      setCustomProjects([])
    } finally {
      setIsLoading(false)
    }
  }

  // Select custom folder
  const handleSelectCustomFolder = async () => {
    if (!ipcRenderer) return
    try {
      const result = await ipcRenderer.invoke('select-cloud-folder')
      if (result.error) {
        onLog('error', result.error)
        return
      }
      if (result.canceled) return

      if (result.folderPath) {
        setCustomPath(result.folderPath)
        try { localStorage.setItem('capcut_merge_custom_folder', result.folderPath) } catch {}
        loadCustomProjects(result.folderPath)
        onLog('info', `Pasta selecionada: ${result.folderPath}`)
      }
    } catch (error) {
      onLog('error', 'Erro ao selecionar pasta')
    }
  }

  // Refresh current source
  const handleRefresh = () => {
    if (projectSource === 'local') {
      loadLocalProjects()
    } else {
      loadCustomProjects()
    }
  }

  const toggleProjectSelection = (project: ProjectInfo) => {
    const isSelected = selectedProjects.some(p => p.path === project.path)
    if (isSelected) {
      setSelectedProjects(prev => prev.filter(p => p.path !== project.path))
    } else {
      setSelectedProjects(prev => [...prev, project])
    }
  }

  const moveProject = (index: number, direction: 'up' | 'down') => {
    const newSelected = [...selectedProjects]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= newSelected.length) return
    [newSelected[index], newSelected[newIndex]] = [newSelected[newIndex], newSelected[index]]
    setSelectedProjects(newSelected)
  }

  const removeFromSelection = (project: ProjectInfo) => {
    setSelectedProjects(prev => prev.filter(p => p.path !== project.path))
  }

  const getTotalDuration = () => {
    return selectedProjects.reduce((sum, p) => sum + p.duration, 0)
  }

  const handleMerge = async () => {
    if (selectedProjects.length < 2) {
      onLog('warning', 'Selecione pelo menos 2 projetos')
      return
    }

    setIsMerging(true)

    try {
      // Check if any project is from a cloud cache folder
      const isCloudProject = (path: string) => path.includes('.cloud_cache')
      const hasCloudProjects = selectedProjects.some(p => isCloudProject(p.path))

      let projectPathsToMerge = selectedProjects.map(p => p.path)

      // If there are cloud projects, copy them to local first
      if (hasCloudProjects) {
        onLog('info', `Copiando ${selectedProjects.filter(p => isCloudProject(p.path)).length} projeto(s) da nuvem para local...`)

        const localPaths: string[] = []
        for (const project of selectedProjects) {
          if (isCloudProject(project.path)) {
            const copyResult = await ipcRenderer.invoke('copy-project-to-local', {
              projectPath: project.path
            })

            if (copyResult.error) {
              onLog('error', `Erro ao copiar ${project.name}: ${copyResult.error}`)
              setIsMerging(false)
              return
            }

            if (copyResult.alreadyExists) {
              onLog('info', `Projeto ${copyResult.projectName} já existe localmente`)
            } else {
              onLog('success', `Projeto ${copyResult.projectName} copiado para local`)
            }
            localPaths.push(copyResult.localPath)
          } else {
            localPaths.push(project.path)
          }
        }

        projectPathsToMerge = localPaths
        // Refresh local projects list
        loadLocalProjects()
      }

      onLog('info', `Mesclando ${selectedProjects.length} projetos...`)

      const result = await ipcRenderer.invoke('merge-projects', {
        projectPaths: projectPathsToMerge,
        outputName: outputName || undefined,
        mode: mergeMode
      })

      if (result.error) {
        onLog('error', result.error)
      } else {
        const modeText = mergeMode === 'groups' ? `${result.projectCount} grupos` : 'todas as tracks'
        onLog('success', `Projeto "${result.name}" criado com ${modeText}!`)
        setLastMergedName(result.name)
        setLastMergedPath(result.path)
        setShowSuccess(true)
        setSelectedProjects([])
        setOutputName('')
        handleRefresh() // Refresh list
        onProjectChange?.()

        // Hide success after 5 seconds
        setTimeout(() => setShowSuccess(false), 5000)
      }
    } catch (error) {
      onLog('error', 'Erro ao mesclar projetos')
    } finally {
      setIsMerging(false)
    }
  }

  // Get projects based on current source
  const currentProjects = projectSource === 'local' ? projects : customProjects
  const availableProjects = currentProjects.filter(p => !selectedProjects.some(sp => sp.path === p.path))

  const handleCleanSubtitles = async (pathToClean?: string) => {
    const targetPath = pathToClean || lastMergedPath
    if (!targetPath || !ipcRenderer) return

    setIsCleaning(true)
    onLog('info', `Limpando legendas...`)

    try {
      const result = await ipcRenderer.invoke('clean-subtitles', {
        projectPath: targetPath
      })

      if (result.error) {
        onLog('error', result.error)
      } else {
        onLog('success', result.message)
      }
    } catch (error) {
      onLog('error', 'Erro ao limpar legendas')
    } finally {
      setIsCleaning(false)
    }
  }

  // Calculate timeline preview data
  const timelineData = useMemo(() => {
    const totalDuration = getTotalDuration()
    if (totalDuration === 0) return []

    let currentStart = 0
    return selectedProjects.map((project, index) => {
      const left = (currentStart / totalDuration) * 100
      const width = (project.duration / totalDuration) * 100
      currentStart += project.duration
      return {
        ...project,
        left,
        width,
        color: TIMELINE_COLORS[index % TIMELINE_COLORS.length]
      }
    })
  }, [selectedProjects])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium text-white">Mesclar Projetos</span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="p-1 text-text-muted hover:text-primary transition-colors disabled:opacity-50"
          title="Atualizar lista"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Toggle Local / Outra Pasta */}
      <div className="flex rounded-lg bg-white/5 p-0.5">
        <button
          onClick={() => setProjectSource('local')}
          className={`flex-1 py-1.5 px-2 rounded-md text-[10px] font-medium transition-all flex items-center justify-center gap-1 ${
            projectSource === 'local'
              ? 'bg-primary text-white'
              : 'text-text-muted hover:text-white'
          }`}
        >
          <FolderOpen className="w-3 h-3" />
          Local
        </button>
        <button
          onClick={() => {
            setProjectSource('custom')
            if (customPath && customProjects.length === 0) {
              loadCustomProjects()
            }
          }}
          className={`flex-1 py-1.5 px-2 rounded-md text-[10px] font-medium transition-all flex items-center justify-center gap-1 ${
            projectSource === 'custom'
              ? 'bg-primary text-white'
              : 'text-text-muted hover:text-white'
          }`}
        >
          <Cloud className="w-3 h-3" />
          Outra Pasta
        </button>
      </div>

      {/* Custom folder selector */}
      {projectSource === 'custom' && (
        <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
          <span className="text-[10px] text-text-muted truncate flex-1" title={customPath || undefined}>
            {customPath ? customPath.split(/[/\\]/).pop() : 'Nenhuma pasta selecionada'}
          </span>
          <button
            onClick={handleSelectCustomFolder}
            className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-1 ml-2"
            title="Selecionar pasta"
          >
            <FolderOpen className="w-3 h-3" />
            {customPath ? 'Alterar' : 'Selecionar'}
          </button>
        </div>
      )}

      {/* Clean subtitles button - when project is open */}
      {currentProjectPath && !showSuccess && (
        <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 space-y-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span className="text-xs font-medium text-yellow-400">
                Correção de Legendas
              </span>
            </div>
            <p className="text-[10px] text-text-muted leading-relaxed">
              Use após mesclar projetos com legendas. Primeiro abra o projeto mesclado no CapCut
              (para ele processar os arquivos), feche o CapCut, e então clique no botão abaixo
              para corrigir as legendas que aparecem como JSON.
            </p>
          </div>
          <button
            onClick={() => handleCleanSubtitles(currentProjectPath)}
            disabled={isCleaning}
            className="w-full py-2 px-3 rounded-lg bg-yellow-500/20 text-xs text-yellow-400 hover:bg-yellow-500/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 font-medium"
          >
            {isCleaning ? (
              <>
                <span className="w-3 h-3 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
                Corrigindo legendas...
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3" />
                Corrigir Legendas do Projeto
              </>
            )}
          </button>
        </div>
      )}

      {/* Success message with clean button */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 rounded-xl bg-green-500/20 border border-green-500/50 space-y-2"
          >
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-400">
                Projeto "{lastMergedName}" criado com sucesso!
              </span>
            </div>
            <p className="text-[10px] text-green-300/70">
              Abra no CapCut, feche, e depois corrija as legendas na aba MESCLAR.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeline Preview */}
      {selectedProjects.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-text-secondary flex items-center gap-2">
            <Play className="w-3 h-3" />
            PREVIEW DA TIMELINE
          </label>
          <div className="p-2 rounded-xl bg-white/5 border border-border">
            {/* Timeline bar */}
            <div className="h-8 bg-black/30 rounded relative overflow-hidden">
              {timelineData.map((project, index) => (
                <div
                  key={project.path}
                  className="absolute h-full flex items-center justify-center overflow-hidden transition-all cursor-pointer hover:brightness-125"
                  style={{
                    left: `${project.left}%`,
                    width: `${Math.max(project.width, 1)}%`,
                    backgroundColor: project.color,
                  }}
                  title={`${project.name} (${formatDuration(project.duration)})`}
                  onClick={() => removeFromSelection(project)}
                >
                  <span className="text-[9px] font-medium text-white truncate px-1 drop-shadow">
                    {project.width > 15 ? project.name.substring(0, Math.floor(project.width / 5)) : (index + 1)}
                  </span>
                </div>
              ))}
            </div>
            {/* Time markers */}
            <div className="flex justify-between text-[9px] text-text-muted mt-1 px-1">
              <span>0:00</span>
              <span>{formatDuration(getTotalDuration())}</span>
            </div>
          </div>
        </div>
      )}

      {/* Selected projects (order list) */}
      {selectedProjects.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-text-secondary flex items-center gap-2">
            ORDEM ({selectedProjects.length} projetos • {formatDuration(getTotalDuration())})
          </label>
          <div className="space-y-1 p-2 rounded-xl bg-white/5 border border-border max-h-32 overflow-y-auto">
            {selectedProjects.map((project, index) => (
              <div
                key={project.path}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5"
              >
                <span
                  className="w-4 h-4 flex items-center justify-center text-[10px] font-bold text-white rounded flex-shrink-0"
                  style={{ backgroundColor: TIMELINE_COLORS[index % TIMELINE_COLORS.length] }}
                >
                  {index + 1}
                </span>
                <span className="flex-1 text-xs text-white truncate" title={project.name}>
                  {project.name}
                </span>
                <span className="text-[10px] text-text-muted flex-shrink-0">
                  {formatDuration(project.duration)}
                </span>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => moveProject(index, 'up')}
                    disabled={index === 0}
                    className="p-0.5 text-text-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Mover para cima"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => moveProject(index, 'down')}
                    disabled={index === selectedProjects.length - 1}
                    className="p-0.5 text-text-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Mover para baixo"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => removeFromSelection(project)}
                    className="p-0.5 text-red-400 hover:text-red-300"
                    title="Remover"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available projects */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-text-secondary flex items-center gap-2">
          <FolderOpen className="w-3 h-3" />
          PROJETOS DISPONÍVEIS ({availableProjects.length})
        </label>
        <div className="space-y-1 max-h-40 overflow-y-auto p-2 rounded-xl bg-white/5 border border-border">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : projectSource === 'custom' && !customPath ? (
            <div className="text-center py-6">
              <Cloud className="w-8 h-8 text-primary mx-auto mb-2 opacity-30" />
              <p className="text-xs text-text-muted">Selecione uma pasta</p>
              <p className="text-[10px] text-text-muted">para ver os projetos</p>
              <button
                onClick={handleSelectCustomFolder}
                className="mt-3 text-[10px] px-3 py-1.5 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors"
              >
                Selecionar pasta
              </button>
            </div>
          ) : availableProjects.length === 0 ? (
            <div className="flex items-center justify-center py-4 text-xs text-text-muted">
              {currentProjects.length === 0 ? 'Nenhum projeto encontrado' : 'Todos os projetos selecionados'}
            </div>
          ) : (
            availableProjects.map((project) => (
              <button
                key={project.path}
                onClick={() => toggleProjectSelection(project)}
                className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors text-left group"
              >
                <div className="w-4 h-4 rounded border border-border-light flex items-center justify-center group-hover:border-primary flex-shrink-0">
                  <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100">+</span>
                </div>
                <span className="flex-1 text-xs text-white truncate" title={project.name}>
                  {project.name}
                </span>
                <div className="flex items-center gap-1 text-[10px] text-text-muted flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  {formatDuration(project.duration)}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Merge mode toggle */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-text-secondary">MODO DE MESCLAGEM</label>
        <div className="flex gap-2">
          <button
            onClick={() => setMergeMode('flat')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
              mergeMode === 'flat'
                ? 'bg-primary text-white'
                : 'bg-white/5 text-text-muted hover:bg-white/10'
            }`}
          >
            Direto (legendas OK)
          </button>
          <button
            onClick={() => setMergeMode('groups')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
              mergeMode === 'groups'
                ? 'bg-primary text-white'
                : 'bg-white/5 text-text-muted hover:bg-white/10'
            }`}
          >
            Com Grupos
          </button>
        </div>
        <p className="text-[10px] text-text-muted">
          {mergeMode === 'flat'
            ? 'Todas as tracks ficam direto na timeline. Legendas funcionam normalmente.'
            : 'Cada projeto vira um Clipe Composto. Legendas podem aparecer como JSON.'}
        </p>
      </div>

      {/* Output name */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-text-secondary">NOME DO PROJETO FINAL</label>
        <input
          type="text"
          value={outputName}
          onChange={(e) => setOutputName(e.target.value)}
          placeholder="Deixe vazio para gerar automaticamente"
          className="input w-full text-sm"
        />
      </div>

      {/* Warning */}
      {selectedProjects.length === 1 && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
          <span className="text-xs text-yellow-400">Selecione pelo menos 2 projetos para mesclar</span>
        </div>
      )}

      {/* Merge button */}
      <button
        onClick={handleMerge}
        disabled={selectedProjects.length < 2 || isMerging}
        className="w-full py-3 px-4 bg-primary text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:brightness-110"
      >
        {isMerging ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Mesclando...
          </>
        ) : (
          <>
            <Layers className="w-4 h-4" />
            Mesclar {selectedProjects.length} Projetos
          </>
        )}
      </button>

      {/* Info */}
      <p className="text-[10px] text-text-muted text-center">
        Cada projeto será convertido em um grupo (Clipe Composto) no projeto final
      </p>
    </div>
  )
}
