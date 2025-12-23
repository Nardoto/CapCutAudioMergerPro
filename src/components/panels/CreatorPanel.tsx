import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, FolderOpen, Play, Key, Globe, Mic, Image, FileText, Loader2, CheckCircle, XCircle, ExternalLink, Eye, ImageIcon, Volume2, Plus, Wand2, Square, RefreshCw, AlertCircle } from 'lucide-react'
import type { LogEntry } from '../../types'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

// Configuracoes - Todas as 30 vozes do Gemini TTS com caracteristicas
const VOZES = [
  // Vozes agudas (Higher pitch)
  { id: 'Zephyr', name: 'Zephyr', desc: 'Bright, Higher pitch' },
  { id: 'Leda', name: 'Leda', desc: 'Youthful, Higher pitch' },
  { id: 'Laomedeia', name: 'Laomedeia', desc: 'Upbeat, Higher pitch' },
  { id: 'Achernar', name: 'Achernar', desc: 'Soft, Higher pitch' },
  // Vozes medias (Middle pitch)
  { id: 'Puck', name: 'Puck', desc: 'Upbeat, Middle pitch' },
  { id: 'Kore', name: 'Kore', desc: 'Firm, Middle pitch' },
  { id: 'Aoede', name: 'Aoede', desc: 'Breezy, Middle pitch' },
  { id: 'Callirrhoe', name: 'Callirrhoe', desc: 'Easy-going, Middle pitch' },
  { id: 'Autonoe', name: 'Autonoe', desc: 'Bright, Middle pitch' },
  { id: 'Despina', name: 'Despina', desc: 'Smooth, Middle pitch' },
  { id: 'Erinome', name: 'Erinome', desc: 'Clear, Middle pitch' },
  { id: 'Rasalgethi', name: 'Rasalgethi', desc: 'Informative, Middle pitch' },
  { id: 'Gacrux', name: 'Gacrux', desc: 'Mature, Middle pitch' },
  { id: 'Pulcherrima', name: 'Pulcherrima', desc: 'Forward, Middle pitch' },
  { id: 'Vindemiatrix', name: 'Vindemiatrix', desc: 'Gentle, Middle pitch' },
  { id: 'Sadaltager', name: 'Sadaltager', desc: 'Knowledgeable, Middle pitch' },
  { id: 'Sulafat', name: 'Sulafat', desc: 'Warm, Middle pitch' },
  // Vozes medio-graves (Lower middle pitch)
  { id: 'Fenrir', name: 'Fenrir', desc: 'Excitable, Lower middle pitch' },
  { id: 'Orus', name: 'Orus', desc: 'Firm, Lower middle pitch' },
  { id: 'Iapetus', name: 'Iapetus', desc: 'Clear, Lower middle pitch' },
  { id: 'Umbriel', name: 'Umbriel', desc: 'Easy-going, Lower middle pitch' },
  { id: 'Alnilam', name: 'Alnilam', desc: 'Firm, Lower middle pitch' },
  { id: 'Schedar', name: 'Schedar', desc: 'Even, Lower middle pitch' },
  { id: 'Achird', name: 'Achird', desc: 'Friendly, Lower middle pitch' },
  { id: 'Zubenelgenubi', name: 'Zubenelgenubi', desc: 'Casual, Lower middle pitch' },
  // Vozes graves (Lower pitch)
  { id: 'Charon', name: 'Charon', desc: 'Informative, Lower pitch' },
  { id: 'Enceladus', name: 'Enceladus', desc: 'Breathy, Lower pitch' },
  { id: 'Algieba', name: 'Algieba', desc: 'Smooth, Lower pitch' },
  { id: 'Algenib', name: 'Algenib', desc: 'Gravelly, Lower pitch' },
  { id: 'Sadachbia', name: 'Sadachbia', desc: 'Lively, Lower pitch' },
]

const IDIOMAS = [
  { id: 'Portugues', name: 'Portugues' },
  { id: 'Ingles', name: 'English' },
  { id: 'Espanhol', name: 'Espanol' },
]

// Todos os estilos de imagem
const ESTILOS = [
  { id: 'Fotografia Profissional', name: 'Foto Pro' },
  { id: 'Fotografia Cinematica', name: 'Cinematico' },
  { id: 'Arte Digital', name: 'Arte Digital' },
  { id: 'Ilustracao', name: 'Ilustracao' },
  { id: 'Pintura a Oleo', name: 'Pintura Oleo' },
  { id: 'Arte Conceitual', name: 'Concept Art' },
  { id: 'Minimalista', name: 'Minimalista' },
  { id: 'Retro/Vintage', name: 'Vintage' },
  { id: 'Neon/Cyberpunk', name: 'Cyberpunk' },
  { id: 'Aquarela', name: 'Aquarela' },
  { id: '3D Render', name: '3D Render' },
  { id: 'Anime/Manga', name: 'Anime' },
]

const ASPECTOS = [
  { id: '9:16', name: '9:16 Vertical' },
  { id: '16:9', name: '16:9 Horizontal' },
  { id: '1:1', name: '1:1 Quadrado' },
  { id: '4:3', name: '4:3 Fullscreen' },
  { id: '3:4', name: '3:4 Portrait' },
]

// Tamanhos de roteiro expandidos
const TAMANHOS_ROTEIRO = [
  { id: '500', name: '500 (~15s)' },
  { id: '1000', name: '1K (~30s)' },
  { id: '2000', name: '2K (~1min)' },
  { id: '4000', name: '4K (~2min)' },
  { id: '5000', name: '5K (~2.5min)' },
  { id: '8000', name: '8K (~4min)' },
  { id: '10000', name: '10K (~5min)' },
  { id: '15000', name: '15K (~7min)' },
  { id: '20000', name: '20K (~10min)' },
  { id: '30000', name: '30K (~15min)' },
  { id: '40000', name: '40K (~20min)' },
  { id: '50000', name: '50K (~25min)' },
  { id: '60000', name: '60K (~30min)' },
]

// Quantidades de imagens expandidas
const QTD_IMAGENS = [
  { id: '1', name: '1' },
  { id: '3', name: '3' },
  { id: '5', name: '5' },
  { id: '8', name: '8' },
  { id: '10', name: '10' },
  { id: '15', name: '15' },
  { id: '20', name: '20' },
  { id: '25', name: '25' },
  { id: '30', name: '30' },
  { id: '40', name: '40' },
  { id: '50', name: '50' },
]

interface CreatorPanelProps {
  onLog: (type: LogEntry['type'], message: string) => void
  isPro: boolean
  draftPath: string | null
  onReanalyze?: () => void
}

export default function CreatorPanel({ onLog, isPro, draftPath, onReanalyze }: CreatorPanelProps) {
  // Form state
  const [apiKey, setApiKey] = useState('')
  const [tema, setTema] = useState('')
  const [instrucoes, setInstrucoes] = useState('')
  const [idioma, setIdioma] = useState('Portugues')
  const [voz, setVoz] = useState('Kore')
  const [estilo, setEstilo] = useState('Fotografia Profissional')
  const [aspecto, setAspecto] = useState('9:16')
  const [tamanhoRoteiro, setTamanhoRoteiro] = useState('2000')
  const [qtdImagens, setQtdImagens] = useState('5')
  const [pastaSaida, setPastaSaida] = useState('')

  // Progress state
  const [isGenerating, setIsGenerating] = useState(false)
  const [isInserting, setIsInserting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [result, setResult] = useState<any>(null)

  // Options
  const [addAnimations, setAddAnimations] = useState(true)
  const [gerarImagens, setGerarImagens] = useState(true)

  // Voice preview
  const [isPlayingVoice, setIsPlayingVoice] = useState<string | false>(false)
  const [showVoiceSelector, setShowVoiceSelector] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Preview state
  const [previewImages, setPreviewImages] = useState<string[]>([])
  const [previewScript, setPreviewScript] = useState('')
  const [audioChunks, setAudioChunks] = useState<any[]>([])
  const [playingAudioPart, setPlayingAudioPart] = useState<number | null>(null)

  // Daily usage counter
  const [dailyUsage, setDailyUsage] = useState<{
    texto: number
    imagens: number
    tts: number
    date: string
  }>({ texto: 0, imagens: 0, tts: 0, date: '' })

  // Load saved API key and daily usage
  useEffect(() => {
    const saved = localStorage.getItem('google_api_key')
    if (saved) setApiKey(saved)
    const savedFolder = localStorage.getItem('creator_output_folder')
    if (savedFolder) setPastaSaida(savedFolder)

    // Load daily usage
    const today = new Date().toISOString().split('T')[0]
    const savedUsage = localStorage.getItem('creator_daily_usage')
    if (savedUsage) {
      const usage = JSON.parse(savedUsage)
      // Reset if it's a new day
      if (usage.date !== today) {
        setDailyUsage({ texto: 0, imagens: 0, tts: 0, date: today })
      } else {
        setDailyUsage(usage)
      }
    } else {
      setDailyUsage({ texto: 0, imagens: 0, tts: 0, date: today })
    }
  }, [])

  // Load preview when result is ready
  useEffect(() => {
    if (result?.projectPath && ipcRenderer) {
      loadPreview(result.projectPath)
    }
  }, [result])

  const loadPreview = async (projectPath: string) => {
    try {
      // Load script
      const scriptPath = `${projectPath}/roteiro.txt`
      const scriptContent = await ipcRenderer.invoke('read-file-content', scriptPath)
      if (scriptContent) setPreviewScript(scriptContent)

      // Load images
      const imagesFolder = `${projectPath}/imagens`
      const imageFiles = await ipcRenderer.invoke('list-folder-files', imagesFolder)
      if (imageFiles && imageFiles.length > 0) {
        const imagePaths = imageFiles
          .filter((f: string) => f.endsWith('.png') || f.endsWith('.jpg'))
          .map((f: string) => `${imagesFolder}/${f}`)
        setPreviewImages(imagePaths)
      }

      // Load audio chunks info
      const chunksPath = `${projectPath}/audio_chunks.json`
      const chunksContent = await ipcRenderer.invoke('read-file-content', chunksPath)
      if (chunksContent) {
        try {
          const chunks = JSON.parse(chunksContent)
          setAudioChunks(chunks)
        } catch (e) {}
      }
    } catch (e) {
      console.error('Error loading preview:', e)
    }
  }

  const playAudioPart = async (partIndex: number) => {
    if (!result?.projectPath) return

    // Se ja esta tocando, para
    if (playingAudioPart === partIndex && audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setPlayingAudioPart(null)
      return
    }

    // Para o audio anterior
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }

    const audioPath = `${result.projectPath}/audios/parte_${String(partIndex).padStart(2, '0')}.wav`
    const audio = new Audio(`file://${audioPath}`)
    audioRef.current = audio

    audio.onplay = () => setPlayingAudioPart(partIndex)
    audio.onended = () => setPlayingAudioPart(null)
    audio.onerror = () => {
      setPlayingAudioPart(null)
      onLog('error', 'Erro ao tocar audio')
    }

    audio.play()
  }

  const saveApiKey = () => {
    localStorage.setItem('google_api_key', apiKey)
    onLog('success', 'API Key salva!')
  }

  const selectOutputFolder = async () => {
    if (!ipcRenderer) return
    try {
      const result = await ipcRenderer.invoke('select-output-folder')
      if (result) {
        setPastaSaida(result)
        localStorage.setItem('creator_output_folder', result)
        onLog('success', `Pasta selecionada: ${result}`)
      }
    } catch (error) {
      onLog('error', 'Erro ao selecionar pasta: ' + error)
    }
  }

  const playVoicePreview = async (voiceId: string) => {
    // Se já está tocando a mesma voz, para
    if (isPlayingVoice === voiceId && audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlayingVoice(false)
      return
    }

    // Para o áudio anterior se estiver tocando
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }

    try {
      const audioPath = await ipcRenderer.invoke('get-voice-preview-path', voiceId)
      if (!audioPath) {
        onLog('error', 'Arquivo de audio nao encontrado')
        return
      }

      const audio = new Audio(`file://${audioPath}`)
      audioRef.current = audio

      audio.onplay = () => setIsPlayingVoice(voiceId)
      audio.onended = () => setIsPlayingVoice(false)
      audio.onerror = () => {
        setIsPlayingVoice(false)
        onLog('error', 'Erro ao tocar preview da voz')
      }

      audio.play()
    } catch (error) {
      onLog('error', 'Erro ao carregar audio: ' + error)
    }
  }

  const startGeneration = async () => {
    if (!apiKey) {
      onLog('error', 'Insira a API Key do Google AI')
      return
    }
    if (!tema) {
      onLog('error', 'Insira o tema do video')
      return
    }
    if (!pastaSaida) {
      onLog('error', 'Selecione a pasta de saida')
      return
    }

    setIsGenerating(true)
    setProgress(0)
    setStatus('Iniciando...')
    setResult(null)
    setPreviewScript('')
    setPreviewImages([])
    setAudioChunks([])

    onLog('info', `Gerando conteudo: ${tema}`)

    // Iniciar geracao e obter o progressFile
    const progressFile = await ipcRenderer.invoke('start-content-generation', {
      apiKey,
      tema,
      instrucoes,
      idioma,
      voz,
      estilo,
      aspecto,
      tamanhoRoteiro,
      qtdImagens: parseInt(qtdImagens),
      pastaSaida,
      gerarImagens,
    })

    if (!progressFile) {
      onLog('error', 'Erro ao iniciar geracao')
      setIsGenerating(false)
      return
    }

    // Polling do progresso a cada 500ms
    const pollInterval = setInterval(async () => {
      try {
        const progressData = await ipcRenderer.invoke('get-content-progress', progressFile)
        if (progressData) {
          setProgress(progressData.progress || 0)
          setStatus(progressData.status || 'Processando...')

          // Carregar roteiro parcial se disponivel
          if (progressData.projectPath && progressData.progress > 20) {
            const scriptPath = `${progressData.projectPath}/roteiro.txt`
            const scriptContent = await ipcRenderer.invoke('read-file-content', scriptPath)
            if (scriptContent) setPreviewScript(scriptContent)
          }

          // Carregar imagens parciais se disponivel
          if (progressData.projectPath && progressData.progress > 30) {
            const imagesFolder = `${progressData.projectPath}/imagens`
            const imageFiles = await ipcRenderer.invoke('list-folder-files', imagesFolder)
            if (imageFiles && imageFiles.length > 0) {
              const imagePaths = imageFiles
                .filter((f: string) => f.endsWith('.png') || f.endsWith('.jpg'))
                .map((f: string) => `${imagesFolder}/${f}`)
              setPreviewImages(imagePaths)
            }
          }

          // Carregar status dos chunks de audio
          if (progressData.projectPath && progressData.progress > 70) {
            const chunksPath = `${progressData.projectPath}/audio_chunks.json`
            const chunksContent = await ipcRenderer.invoke('read-file-content', chunksPath)
            if (chunksContent) {
              try {
                const chunks = JSON.parse(chunksContent)
                setAudioChunks(chunks)
              } catch (e) {}
            }
          }
        }
      } catch (e) {
        // Arquivo pode nao existir ainda
      }
    }, 500)

    // Aguardar resultado final
    try {
      const response = await ipcRenderer.invoke('wait-content-generation', progressFile)

      clearInterval(pollInterval)

      if (response.success) {
        setResult(response)
        setProgress(100)
        setStatus('Concluido!')
        onLog('success', `Conteudo gerado em: ${response.projectPath}`)

        // Update daily usage counters
        if (response.apiUsage) {
          const today = new Date().toISOString().split('T')[0]
          const newUsage = {
            texto: dailyUsage.texto + (response.apiUsage.texto || 0),
            imagens: dailyUsage.imagens + (response.apiUsage.imagens || 0),
            tts: dailyUsage.tts + (response.apiUsage.tts || 0),
            date: today
          }
          setDailyUsage(newUsage)
          localStorage.setItem('creator_daily_usage', JSON.stringify(newUsage))
        }
      } else {
        onLog('error', response.error || 'Erro na geracao')
        setStatus('Erro!')
      }
    } catch (error) {
      clearInterval(pollInterval)
      onLog('error', `Erro: ${error}`)
      setStatus('Erro!')
    } finally {
      setIsGenerating(false)
    }
  }

  const openFolder = () => {
    if (result?.projectPath && ipcRenderer) {
      ipcRenderer.invoke('open-folder-in-explorer', result.projectPath)
    }
  }

  const insertIntoProject = async () => {
    if (!result?.projectPath || !draftPath || !ipcRenderer) {
      onLog('error', 'Abra um projeto CapCut primeiro')
      return
    }

    setIsInserting(true)
    onLog('info', 'Inserindo conteudo no projeto...')

    try {
      const response = await ipcRenderer.invoke('insert-creator-content', {
        draftPath,
        contentFolder: result.projectPath,
        addAnimations
      })

      if (response.success) {
        onLog('success', `Conteudo inserido! ${response.stats?.imagesInserted} imagens`)
        if (response.logs) {
          response.logs.forEach((log: string) => onLog('info', log))
        }
        if (onReanalyze) onReanalyze()
      } else {
        onLog('error', response.error || 'Erro ao inserir conteudo')
      }
    } catch (error) {
      onLog('error', `Erro: ${error}`)
    } finally {
      setIsInserting(false)
    }
  }

  if (!isPro) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <Sparkles className="w-16 h-16 text-orange-500 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Content Creator</h2>
        <p className="text-text-muted mb-4">
          Gere roteiros, imagens e audio automaticamente com IA!
        </p>
        <div className="bg-orange-500/20 border border-orange-500 rounded-lg px-4 py-2">
          <span className="text-orange-400 font-bold">Recurso VIP</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full gap-4 p-4">
      {/* LEFT SIDE - Controls */}
      <div className="w-80 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-orange-500" />
          <h2 className="text-base font-bold text-white">Content Creator</h2>
          <span className="bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">VIP</span>
        </div>

        {/* API Key */}
        <div className="bg-background-dark-alt/50 rounded-lg p-2.5 border border-border-light/30">
          <label className="text-xs font-medium text-orange-400 mb-1.5 flex items-center gap-1.5">
            <Key className="w-3 h-3" /> API Key
          </label>
          <div className="flex gap-1.5">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Cole sua API Key..."
              className="flex-1 bg-background-dark text-white text-xs px-2 py-1.5 rounded border border-border-light/50 focus:border-orange-500 outline-none"
            />
            <button
              onClick={saveApiKey}
              className="px-2 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded transition-colors"
            >
              OK
            </button>
          </div>
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-orange-400/70 hover:text-orange-400 mt-1 inline-block"
          >
            Obter API Key gratuita
          </a>
        </div>

        {/* Daily Usage Counter */}
        <div className="bg-background-dark-alt/50 rounded-lg p-2 border border-border-light/30">
          <div className="text-[10px] font-medium text-orange-400 mb-1.5">Uso Diario (limite gratuito)</div>
          <div className="flex gap-2 text-[10px]">
            <div className={`flex-1 px-2 py-1 rounded ${dailyUsage.texto > 400 ? 'bg-red-500/20 text-red-400' : dailyUsage.texto > 250 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
              <span className="font-medium">Texto:</span> {dailyUsage.texto}/500
            </div>
            <div className={`flex-1 px-2 py-1 rounded ${dailyUsage.imagens > 80 ? 'bg-red-500/20 text-red-400' : dailyUsage.imagens > 50 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
              <span className="font-medium">Img:</span> {dailyUsage.imagens}/100
            </div>
            <div className={`flex-1 px-2 py-1 rounded ${dailyUsage.tts > 80 ? 'bg-red-500/20 text-red-400' : dailyUsage.tts > 50 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
              <span className="font-medium">TTS:</span> {dailyUsage.tts}/100
            </div>
          </div>
        </div>

        {/* Tema */}
        <div className="bg-background-dark-alt/50 rounded-lg p-2.5 border border-border-light/30">
          <label className="text-xs font-medium text-orange-400 mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3 h-3" /> Tema do Video
          </label>
          <input
            type="text"
            value={tema}
            onChange={(e) => setTema(e.target.value)}
            placeholder="Ex: como ganhar dinheiro em 2025"
            className="w-full bg-background-dark text-white text-xs px-2 py-1.5 rounded border border-border-light/50 focus:border-orange-500 outline-none mb-1.5"
          />
          <textarea
            value={instrucoes}
            onChange={(e) => setInstrucoes(e.target.value)}
            placeholder="Instrucoes opcionais..."
            rows={2}
            className="w-full bg-background-dark text-white text-xs px-2 py-1.5 rounded border border-border-light/50 focus:border-orange-500 outline-none resize-none"
          />
        </div>

        {/* Config Grid - 2x3 */}
        <div className="grid grid-cols-2 gap-2">
          {/* Idioma */}
          <div className="bg-background-dark-alt/50 rounded-lg p-2 border border-border-light/30">
            <label className="text-[10px] font-medium text-orange-400 mb-1 flex items-center gap-1">
              <Globe className="w-3 h-3" /> Idioma
            </label>
            <select
              value={idioma}
              onChange={(e) => setIdioma(e.target.value)}
              className="w-full bg-background-dark text-white text-xs px-2 py-1 rounded border border-border-light/50 focus:border-orange-500 outline-none"
            >
              {IDIOMAS.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>

          {/* Voz */}
          <div className="bg-background-dark-alt/50 rounded-lg p-2 border border-border-light/30 relative">
            <label className="text-[10px] font-medium text-orange-400 mb-1 flex items-center gap-1">
              <Mic className="w-3 h-3" /> Voz
            </label>
            {/* Voz selecionada */}
            <div className="flex gap-1">
              <button
                onClick={() => setShowVoiceSelector(!showVoiceSelector)}
                className="flex-1 flex items-center gap-1 bg-background-dark text-white text-xs px-2 py-1 rounded border border-border-light/50 hover:border-orange-500 transition-colors text-left truncate"
              >
                <span className="truncate">{VOZES.find(v => v.id === voz)?.name}</span>
              </button>
              <button
                onClick={() => playVoicePreview(voz)}
                className={`px-1.5 py-1 rounded transition-colors ${
                  isPlayingVoice === voz
                    ? 'bg-orange-500 text-white'
                    : 'bg-background-dark hover:bg-border-light text-orange-400 border border-border-light/50'
                }`}
                title="Ouvir preview"
              >
                {isPlayingVoice === voz ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
            </div>

            {/* Lista de vozes - dropdown */}
            {showVoiceSelector && (
              <div className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-background-dark border border-border-light/50 rounded shadow-lg">
                {VOZES.map((v) => (
                  <div
                    key={v.id}
                    className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-colors ${
                      voz === v.id ? 'bg-orange-500/20' : 'hover:bg-border-light/30'
                    }`}
                    onClick={() => { setVoz(v.id); setShowVoiceSelector(false); }}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); playVoicePreview(v.id); }}
                      className={`p-1 rounded transition-colors flex-shrink-0 ${
                        isPlayingVoice === v.id
                          ? 'bg-orange-500 text-white'
                          : 'hover:bg-border-light text-orange-400'
                      }`}
                    >
                      {isPlayingVoice === v.id ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white">{v.name}</div>
                      <div className="text-[10px] text-text-muted truncate">{v.desc}</div>
                    </div>
                    {voz === v.id && <CheckCircle className="w-3 h-3 text-orange-500 flex-shrink-0" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Estilo */}
          <div className="bg-background-dark-alt/50 rounded-lg p-2 border border-border-light/30">
            <label className="text-[10px] font-medium text-orange-400 mb-1 flex items-center gap-1">
              <Image className="w-3 h-3" /> Estilo
            </label>
            <select
              value={estilo}
              onChange={(e) => setEstilo(e.target.value)}
              className="w-full bg-background-dark text-white text-xs px-2 py-1 rounded border border-border-light/50 focus:border-orange-500 outline-none"
            >
              {ESTILOS.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>

          {/* Aspecto */}
          <div className="bg-background-dark-alt/50 rounded-lg p-2 border border-border-light/30">
            <label className="text-[10px] font-medium text-orange-400 mb-1 flex items-center gap-1">
              <ImageIcon className="w-3 h-3" /> Aspecto
            </label>
            <select
              value={aspecto}
              onChange={(e) => setAspecto(e.target.value)}
              className="w-full bg-background-dark text-white text-xs px-2 py-1 rounded border border-border-light/50 focus:border-orange-500 outline-none"
            >
              {ASPECTOS.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Tamanho Roteiro */}
          <div className="bg-background-dark-alt/50 rounded-lg p-2 border border-border-light/30">
            <label className="text-[10px] font-medium text-orange-400 mb-1 flex items-center gap-1">
              <FileText className="w-3 h-3" /> Roteiro
            </label>
            <select
              value={tamanhoRoteiro}
              onChange={(e) => setTamanhoRoteiro(e.target.value)}
              className="w-full bg-background-dark text-white text-xs px-2 py-1 rounded border border-border-light/50 focus:border-orange-500 outline-none"
            >
              {TAMANHOS_ROTEIRO.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Qtd Imagens */}
          <div className="bg-background-dark-alt/50 rounded-lg p-2 border border-border-light/30">
            <label className="text-[10px] font-medium text-orange-400 mb-1 flex items-center gap-1">
              <ImageIcon className="w-3 h-3" /> Imagens
            </label>
            <select
              value={qtdImagens}
              onChange={(e) => setQtdImagens(e.target.value)}
              className="w-full bg-background-dark text-white text-xs px-2 py-1 rounded border border-border-light/50 focus:border-orange-500 outline-none"
              disabled={!gerarImagens}
            >
              {QTD_IMAGENS.map((q) => (
                <option key={q.id} value={q.id}>{q.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Gerar Imagens Checkbox */}
        <div className="bg-background-dark-alt/50 rounded-lg p-2.5 border border-border-light/30">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={gerarImagens}
              onChange={(e) => setGerarImagens(e.target.checked)}
              className="w-4 h-4 accent-orange-500"
            />
            <span className="text-xs text-white font-medium">Gerar Imagens</span>
          </label>
          <p className="text-[10px] text-text-muted mt-1 ml-6">
            {gerarImagens
              ? 'Imagens serao geradas com IA'
              : 'Apenas roteiro + audio (prompts serao salvos)'}
          </p>
        </div>

        {/* Pasta de Saida */}
        <div className="bg-background-dark-alt/50 rounded-lg p-2.5 border border-border-light/30">
          <label className="text-xs font-medium text-orange-400 mb-1.5 flex items-center gap-1.5">
            <FolderOpen className="w-3 h-3" /> Pasta de Saida
          </label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={pastaSaida}
              readOnly
              placeholder="Selecione..."
              className="flex-1 bg-background-dark text-white text-xs px-2 py-1.5 rounded border border-border-light/50 outline-none truncate"
            />
            <button
              onClick={selectOutputFolder}
              className="px-2 py-1.5 bg-background-dark hover:bg-border-light text-white text-xs rounded transition-colors border border-border-light/50"
            >
              ...
            </button>
          </div>
        </div>

        {/* Progress */}
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-orange-500/10 rounded-lg p-2.5 border border-orange-500/30"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Loader2 className="w-3.5 h-3.5 text-orange-500 animate-spin" />
              <span className="text-xs text-orange-400">{status}</span>
            </div>
            <div className="h-1.5 bg-background-dark rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-orange-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </motion.div>
        )}

        {/* Result Summary */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-500/10 border border-green-500/30 rounded-lg p-2.5"
          >
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-xs text-green-400 font-bold">Concluido!</span>
            </div>
            <div className="text-[10px] text-green-400/70 space-y-0.5">
              <p>Roteiro: {result.scriptLength} chars</p>
              {result.imagesSkipped ? (
                <p>Prompts: {result.promptsSaved} (imagens nao geradas)</p>
              ) : (
                <p>Imagens: {result.imagesGenerated}/{result.imagesRequested}</p>
              )}
              <p>Audio: {result.audioPartsOk}/{result.audioPartsTotal}</p>
            </div>

            {/* Animations toggle */}
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={addAnimations}
                onChange={(e) => setAddAnimations(e.target.checked)}
                className="w-3 h-3 accent-orange-500"
              />
              <span className="text-[10px] text-green-400/70">Adicionar animacoes</span>
            </label>

            <div className="flex gap-1.5 mt-2">
              <button
                onClick={openFolder}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs rounded transition-colors border border-green-500/30"
              >
                <ExternalLink className="w-3 h-3" />
                Pasta
              </button>
              <button
                onClick={insertIntoProject}
                disabled={isInserting || !draftPath}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-white text-xs rounded transition-colors ${
                  !draftPath
                    ? 'bg-gray-600 cursor-not-allowed'
                    : isInserting
                      ? 'bg-orange-600 cursor-wait'
                      : 'bg-orange-500 hover:bg-orange-600'
                }`}
                title={!draftPath ? 'Abra um projeto CapCut primeiro' : ''}
              >
                {isInserting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Plus className="w-3 h-3" />
                )}
                {isInserting ? 'Inserindo...' : 'Inserir no Projeto'}
              </button>
            </div>
          </motion.div>
        )}

        {/* Generate Button */}
        <button
          onClick={startGeneration}
          disabled={isGenerating}
          className={`
            w-full py-2.5 rounded-lg font-bold text-white text-sm transition-all flex items-center justify-center gap-2
            ${isGenerating
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg hover:shadow-orange-500/25'
            }
          `}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              GERAR CONTEUDO
            </>
          )}
        </button>
      </div>

      {/* RIGHT SIDE - Preview */}
      <div className="flex-1 flex flex-col gap-3 overflow-hidden">
        {/* Preview Header */}
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-medium text-white">Preview do Conteudo</span>
        </div>

        {!result && !isGenerating ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center border-2 border-dashed border-border-light/30 rounded-lg">
            <Sparkles className="w-12 h-12 text-orange-500/30 mb-3" />
            <p className="text-sm text-text-muted">Gere conteudo para visualizar</p>
            <p className="text-xs text-text-muted/50 mt-1">Roteiro, imagens e audio aparecerao aqui</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-3 overflow-hidden">
            {/* Script Preview */}
            <div className="flex-1 min-h-0 bg-background-dark-alt/50 rounded-lg border border-border-light/30 flex flex-col overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border-light/30 bg-background-dark/50">
                <FileText className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-xs font-medium text-orange-400">Roteiro</span>
                {previewScript && (
                  <span className="text-[10px] text-text-muted ml-auto">{previewScript.length} chars</span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {previewScript ? (
                  <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{previewScript}</p>
                ) : isGenerating ? (
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Gerando roteiro...
                  </div>
                ) : (
                  <p className="text-xs text-text-muted italic">Roteiro aparecera aqui...</p>
                )}
              </div>
            </div>

            {/* Images Preview */}
            <div className="h-36 bg-background-dark-alt/50 rounded-lg border border-border-light/30 flex flex-col overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border-light/30 bg-background-dark/50">
                <ImageIcon className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-xs font-medium text-orange-400">Imagens</span>
                {previewImages.length > 0 && (
                  <span className="text-[10px] text-text-muted ml-auto">{previewImages.length} imagens</span>
                )}
              </div>
              <div className="flex-1 overflow-x-auto p-2">
                {previewImages.length > 0 ? (
                  <div className="flex gap-2 h-full">
                    {previewImages.map((img, idx) => (
                      <img
                        key={idx}
                        src={`file://${img}`}
                        alt={`Imagem ${idx + 1}`}
                        className="h-full w-auto rounded border border-border-light/50 object-cover"
                      />
                    ))}
                  </div>
                ) : isGenerating ? (
                  <div className="flex items-center justify-center h-full gap-2 text-xs text-text-muted">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Gerando imagens...
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-xs text-text-muted italic">Imagens aparecerao aqui...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Audio Status - Detalhado */}
            {(audioChunks.length > 0 || isGenerating) && (
              <div className="bg-background-dark-alt/50 rounded-lg border border-border-light/30 flex flex-col overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border-light/30 bg-background-dark/50">
                  <Volume2 className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-xs font-medium text-orange-400">Audio</span>
                  {audioChunks.length > 0 && (
                    <>
                      <span className="text-[10px] text-text-muted ml-auto">
                        {audioChunks.filter(c => c.status === 'ok').length}/{audioChunks.length} partes
                      </span>
                      {audioChunks.some(c => c.status === 'error') && (
                        <span className="text-[10px] text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {audioChunks.filter(c => c.status === 'error').length} erro(s)
                        </span>
                      )}
                    </>
                  )}
                </div>
                <div className="p-2 max-h-32 overflow-y-auto">
                  {audioChunks.length > 0 ? (
                    <div className="space-y-1">
                      {audioChunks.map((chunk, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                            chunk.status === 'ok'
                              ? 'bg-green-500/10 border border-green-500/30'
                              : chunk.status === 'error'
                                ? 'bg-red-500/10 border border-red-500/30'
                                : 'bg-background-dark border border-border-light/30'
                          }`}
                        >
                          {chunk.status === 'ok' ? (
                            <button
                              onClick={() => playAudioPart(chunk.index)}
                              className={`p-1 rounded transition-colors flex-shrink-0 ${
                                playingAudioPart === chunk.index
                                  ? 'bg-green-500 text-white'
                                  : 'hover:bg-green-500/30 text-green-400'
                              }`}
                              title="Ouvir parte"
                            >
                              {playingAudioPart === chunk.index ? (
                                <Square className="w-3 h-3" />
                              ) : (
                                <Play className="w-3 h-3" />
                              )}
                            </button>
                          ) : chunk.status === 'error' ? (
                            <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                          ) : (
                            <Loader2 className="w-4 h-4 text-text-muted animate-spin flex-shrink-0" />
                          )}
                          <span className={`font-medium ${
                            chunk.status === 'ok' ? 'text-green-400' :
                            chunk.status === 'error' ? 'text-red-400' : 'text-text-muted'
                          }`}>
                            Parte {chunk.index}
                          </span>
                          <span className="text-[10px] text-text-muted">
                            {chunk.chars} chars
                          </span>
                          {chunk.status === 'error' && chunk.error && (
                            <span className="text-[10px] text-red-400/70 truncate flex-1" title={chunk.error}>
                              {chunk.error.substring(0, 30)}...
                            </span>
                          )}
                          {chunk.status === 'ok' && (
                            <CheckCircle className="w-3 h-3 text-green-500 ml-auto flex-shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : isGenerating ? (
                    <div className="flex items-center justify-center h-12 gap-2 text-xs text-text-muted">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Aguardando geracao de audio...
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
