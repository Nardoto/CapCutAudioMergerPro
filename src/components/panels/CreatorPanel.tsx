import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, FolderOpen, Play, Key, Globe, Mic, Image, FileText, Loader2, CheckCircle, XCircle, ExternalLink, Eye, ImageIcon, Volume2, Plus, Wand2, Square, AlertCircle, Settings, ChevronDown, Maximize2, X } from 'lucide-react'
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

  // Modo de entrada: 'tema' (IA gera roteiro) ou 'roteiro' (usuario cola)
  const [modoEntrada, setModoEntrada] = useState<'tema' | 'roteiro'>('tema')
  const [roteiroCompleto, setRoteiroCompleto] = useState('')
  const [tamanhoChunk, setTamanhoChunk] = useState('300')
  const [gerarSRT, setGerarSRT] = useState(true)

  // Progress state
  const [isGenerating, setIsGenerating] = useState(false)
  const [isInserting, setIsInserting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [result, setResult] = useState<any>(null)
  const [currentProgressFile, setCurrentProgressFile] = useState<string | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Options
  const [addAnimations, setAddAnimations] = useState(true)
  const [gerarImagens, setGerarImagens] = useState(true)

  // Voice preview
  const [isPlayingVoice, setIsPlayingVoice] = useState<string | false>(false)
  const [showVoiceSelector, setShowVoiceSelector] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const voiceSelectorRef = useRef<HTMLDivElement | null>(null)

  // Custom dropdowns state
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  // API config visibility
  const [showApiConfig, setShowApiConfig] = useState(false)

  // Expanded text editor modal
  const [expandedEditor, setExpandedEditor] = useState<'instrucoes' | 'roteiro' | null>(null)

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Voice selector
      if (voiceSelectorRef.current && !voiceSelectorRef.current.contains(event.target as Node)) {
        setShowVoiceSelector(false)
      }
      // Other dropdowns
      if (openDropdown) {
        const ref = dropdownRefs.current[openDropdown]
        if (ref && !ref.contains(event.target as Node)) {
          setOpenDropdown(null)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showVoiceSelector, openDropdown])

  // Close expanded editor with Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && expandedEditor) {
        setExpandedEditor(null)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [expandedEditor])

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

  // Funcao para dividir roteiro de forma inteligente respeitando pontuacoes
  const dividirRoteiro = (texto: string, tamanhoMax: number): string[] => {
    const chunks: string[] = []
    let textoRestante = texto.trim()

    while (textoRestante.length > 0) {
      if (textoRestante.length <= tamanhoMax) {
        chunks.push(textoRestante.trim())
        break
      }

      // Procurar o melhor ponto de corte (pontuacao) dentro do limite
      let pontoCorte = tamanhoMax
      const pontuacoes = ['. ', '! ', '? ', '; ', ': ', '.\n', '!\n', '?\n']

      // Procurar a ultima pontuacao antes do limite
      for (const pontuacao of pontuacoes) {
        const ultimaPontuacao = textoRestante.lastIndexOf(pontuacao, tamanhoMax)
        if (ultimaPontuacao > tamanhoMax * 0.5) { // Pelo menos 50% do tamanho
          pontoCorte = ultimaPontuacao + pontuacao.length
          break
        }
      }

      // Se nao encontrou pontuacao, procurar espaco
      if (pontoCorte === tamanhoMax) {
        const ultimoEspaco = textoRestante.lastIndexOf(' ', tamanhoMax)
        if (ultimoEspaco > tamanhoMax * 0.7) {
          pontoCorte = ultimoEspaco
        }
      }

      const chunk = textoRestante.slice(0, pontoCorte).trim()
      if (chunk) chunks.push(chunk)
      textoRestante = textoRestante.slice(pontoCorte).trim()
    }

    return chunks
  }

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

    // Validacao baseada no modo
    if (modoEntrada === 'tema' && !tema) {
      onLog('error', 'Insira o tema do video')
      return
    }
    if (modoEntrada === 'roteiro' && !roteiroCompleto.trim()) {
      onLog('error', 'Cole o roteiro completo')
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

    // Preparar dados baseado no modo
    let chunks: string[] = []
    if (modoEntrada === 'roteiro') {
      chunks = dividirRoteiro(roteiroCompleto, parseInt(tamanhoChunk))
      onLog('info', `Processando roteiro: ${chunks.length} partes`)
    } else {
      onLog('info', `Gerando conteudo: ${tema}`)
    }

    // Iniciar geracao e obter o progressFile
    const progressFile = await ipcRenderer.invoke('start-content-generation', {
      apiKey,
      tema: modoEntrada === 'tema' ? tema : `[ROTEIRO_PRONTO] ${roteiroCompleto.slice(0, 50)}...`,
      instrucoes,
      idioma,
      voz,
      estilo,
      aspecto,
      tamanhoRoteiro,
      qtdImagens: modoEntrada === 'roteiro' ? chunks.length : parseInt(qtdImagens),
      pastaSaida,
      gerarImagens,
      // Novos parametros para modo roteiro
      modoRoteiro: modoEntrada === 'roteiro',
      roteiroChunks: modoEntrada === 'roteiro' ? chunks : undefined,
      gerarSRT,
    })

    if (!progressFile) {
      onLog('error', 'Erro ao iniciar geracao')
      setIsGenerating(false)
      return
    }

    // Armazenar progressFile para poder cancelar
    setCurrentProgressFile(progressFile)

    // Polling do progresso a cada 500ms
    pollIntervalRef.current = setInterval(async () => {
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

      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }

      if (response.cancelled) {
        // Geração foi cancelada
        setStatus('Cancelado')
        onLog('info', 'Geracao cancelada pelo usuario')
      } else if (response.success) {
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
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      onLog('error', `Erro: ${error}`)
      setStatus('Erro!')
    } finally {
      setIsGenerating(false)
      setCurrentProgressFile(null)
      setIsCancelling(false)
    }
  }

  // Funcao para cancelar geracao em andamento
  const cancelGeneration = async () => {
    if (!currentProgressFile || !ipcRenderer) return

    setIsCancelling(true)
    setStatus('Cancelando...')

    try {
      await ipcRenderer.invoke('cancel-content-generation', currentProgressFile)
    } catch (error) {
      onLog('error', `Erro ao cancelar: ${error}`)
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
    const handleContactVIP = () => {
      const message = encodeURIComponent('Olá! Tenho interesse no plano VIP do CapCut Sync Pro.')
      ipcRenderer?.invoke('open-external', `https://wa.me/5527999132594?text=${message}`)
    }

    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <Sparkles className="w-16 h-16 text-orange-500 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Content Creator</h2>
        <p className="text-text-muted mb-4">
          Gere roteiros, imagens e audio automaticamente com IA!
        </p>
        <button
          onClick={handleContactVIP}
          className="bg-orange-500/20 border border-orange-500 rounded-lg px-4 py-2 hover:bg-orange-500/30 transition-colors cursor-pointer"
        >
          <span className="text-orange-400 font-bold">Quero ser VIP!</span>
        </button>
        <p className="text-text-muted text-xs mt-2">Clique para falar conosco no WhatsApp</p>
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
          <div className="flex-1" />
          <button
            onClick={() => setShowApiConfig(!showApiConfig)}
            className={`p-1.5 rounded-lg transition-colors ${showApiConfig ? 'bg-orange-500/20 text-orange-400' : 'text-text-muted hover:text-white hover:bg-white/10'}`}
            title="Configurações da API"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* API Key & Usage - Collapsible */}
        {showApiConfig && (
          <div className="bg-background-dark-alt/50 rounded-lg p-2.5 space-y-2">
            {/* API Key */}
            <div>
              <label className="text-xs font-medium text-orange-400 mb-1.5 flex items-center gap-1.5">
                <Key className="w-3 h-3" /> API Key
              </label>
              <div className="flex gap-1.5">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Cole sua API Key..."
                  className="flex-1 bg-background-dark text-white text-xs px-2 py-1.5 rounded outline-none hover:bg-white/5 transition-colors"
                />
                <button
                  onClick={saveApiKey}
                  className="px-2 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded transition-colors"
                >
                  OK
                </button>
              </div>
              <button
                onClick={() => ipcRenderer?.invoke('open-external', 'https://aistudio.google.com/apikey')}
                className="text-[10px] text-orange-400/70 hover:text-orange-400 mt-1 inline-block"
              >
                Obter API Key gratuita ↗
              </button>

              {/* Instruções */}
              <div className="mt-2 p-2 bg-background-dark rounded text-[9px] text-text-muted space-y-1.5">
                <div className="text-orange-400 font-medium text-[10px]">Como criar sua API Key:</div>
                <div><span className="text-orange-400">1.</span> Acesse o link acima e faça login</div>
                <div><span className="text-orange-400">2.</span> Clique em "Criar chave de API"</div>
                <div><span className="text-orange-400">3.</span> Configure faturamento (obrigatório, mas é GRÁTIS)</div>
                <div><span className="text-orange-400">4.</span> Copie a chave e cole aqui</div>
                <div className="text-green-400 mt-1">✓ 100% gratuito! Cartão é só verificação.</div>
                <div className="text-text-muted/70">Dica: Use cartão pré-pago com R$1</div>
              </div>
            </div>

            {/* Daily Usage Counter */}
            <div>
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
          </div>
        )}

        {/* Modo de Entrada: Tema ou Roteiro */}
        <div className="bg-background-dark-alt/50 rounded-lg p-2.5 ">
          {/* Toggle */}
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setModoEntrada('tema')}
              className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg transition-all ${
                modoEntrada === 'tema'
                  ? 'bg-orange-500 text-white'
                  : 'bg-background-dark text-text-muted hover:bg-white/10'
              }`}
            >
              <Wand2 className="w-3 h-3 inline mr-1" />
              IA Gera Roteiro
            </button>
            <button
              onClick={() => setModoEntrada('roteiro')}
              className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg transition-all ${
                modoEntrada === 'roteiro'
                  ? 'bg-orange-500 text-white'
                  : 'bg-background-dark text-text-muted hover:bg-white/10'
              }`}
            >
              <FileText className="w-3 h-3 inline mr-1" />
              Colar Roteiro
            </button>
          </div>

          {modoEntrada === 'tema' ? (
            <>
              <label className="text-xs font-medium text-orange-400 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3 h-3" /> Tema do Video
              </label>
              <input
                type="text"
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                placeholder="Ex: como ganhar dinheiro em 2025"
                className="w-full bg-background-dark text-white text-xs px-2 py-1.5 rounded outline-none hover:bg-white/5 transition-colors mb-1.5"
              />
              <div className="relative">
                <textarea
                  value={instrucoes}
                  onChange={(e) => setInstrucoes(e.target.value)}
                  placeholder="Instrucoes opcionais..."
                  rows={2}
                  className="w-full bg-background-dark text-white text-xs px-2 py-1.5 pr-8 rounded outline-none hover:bg-white/5 transition-colors resize-y min-h-[40px]"
                />
                <button
                  onClick={() => setExpandedEditor('instrucoes')}
                  className="absolute top-1.5 right-1.5 p-1 rounded hover:bg-white/10 text-text-muted hover:text-white transition-colors"
                  title="Expandir editor"
                >
                  <Maximize2 className="w-3 h-3" />
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="text-xs font-medium text-orange-400 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3 h-3" /> Cole seu Roteiro Completo
              </label>
              <div className="relative mb-2">
                <textarea
                  value={roteiroCompleto}
                  onChange={(e) => setRoteiroCompleto(e.target.value)}
                  placeholder="Cole aqui seu roteiro completo. O sistema vai dividir automaticamente respeitando as pontuacoes..."
                  rows={5}
                  className="w-full bg-background-dark text-white text-xs px-2 py-1.5 pr-8 rounded outline-none hover:bg-white/5 transition-colors resize-y min-h-[80px]"
                />
                <button
                  onClick={() => setExpandedEditor('roteiro')}
                  className="absolute top-1.5 right-1.5 p-1 rounded hover:bg-white/10 text-text-muted hover:text-white transition-colors"
                  title="Expandir editor"
                >
                  <Maximize2 className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div ref={el => dropdownRefs.current['chunk'] = el} className="flex-1 relative">
                  <label className="text-[10px] text-text-muted mb-1 block">Tamanho do chunk</label>
                  <button
                    onClick={() => setOpenDropdown(openDropdown === 'chunk' ? null : 'chunk')}
                    className="w-full flex items-center justify-between bg-background-dark text-white text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors"
                  >
                    <span>~{tamanhoChunk}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${openDropdown === 'chunk' ? 'rotate-180' : ''}`} />
                  </button>
                  {openDropdown === 'chunk' && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-background-dark rounded shadow-lg overflow-hidden">
                      {[
                        { id: '150', name: '~150 (curto)' },
                        { id: '200', name: '~200' },
                        { id: '300', name: '~300 (padrao)' },
                        { id: '400', name: '~400' },
                        { id: '500', name: '~500 (longo)' },
                        { id: '700', name: '~700' },
                        { id: '1000', name: '~1000' },
                      ].map((c) => (
                        <div
                          key={c.id}
                          className={`px-2 py-1.5 text-xs cursor-pointer transition-colors ${tamanhoChunk === c.id ? 'bg-orange-500/20 text-orange-400' : 'text-white hover:bg-white/10'}`}
                          onClick={() => { setTamanhoChunk(c.id); setOpenDropdown(null); }}
                        >
                          {c.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gerarSRT}
                    onChange={(e) => setGerarSRT(e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-orange-500"
                  />
                  Gerar SRT
                </label>
              </div>
              {roteiroCompleto && (
                <div className="mt-2 text-[10px] text-text-muted">
                  {roteiroCompleto.length} caracteres | ~{Math.ceil(roteiroCompleto.length / parseInt(tamanhoChunk))} partes
                </div>
              )}
            </>
          )}
        </div>

        {/* Config Grid - 2x3 */}
        <div className="grid grid-cols-2 gap-2">
          {/* Idioma */}
          <div ref={el => dropdownRefs.current['idioma'] = el} className="bg-background-dark-alt/50 rounded-lg p-2 relative">
            <label className="text-[10px] font-medium text-orange-400 mb-1 flex items-center gap-1">
              <Globe className="w-3 h-3" /> Idioma
            </label>
            <button
              onClick={() => setOpenDropdown(openDropdown === 'idioma' ? null : 'idioma')}
              className="w-full flex items-center justify-between bg-background-dark text-white text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors"
            >
              <span>{IDIOMAS.find(i => i.id === idioma)?.name}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${openDropdown === 'idioma' ? 'rotate-180' : ''}`} />
            </button>
            {openDropdown === 'idioma' && (
              <div className="absolute z-50 left-0 right-0 mt-1 bg-background-dark rounded shadow-lg overflow-hidden">
                {IDIOMAS.map((i) => (
                  <div
                    key={i.id}
                    className={`px-2 py-1.5 text-xs cursor-pointer transition-colors ${idioma === i.id ? 'bg-orange-500/20 text-orange-400' : 'text-white hover:bg-white/10'}`}
                    onClick={() => { setIdioma(i.id); setOpenDropdown(null); }}
                  >
                    {i.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Voz */}
          <div ref={voiceSelectorRef} className="bg-background-dark-alt/50 rounded-lg p-2 relative">
            <label className="text-[10px] font-medium text-orange-400 mb-1 flex items-center gap-1">
              <Mic className="w-3 h-3" /> Voz
            </label>
            <div className="flex gap-1">
              <button
                onClick={() => setShowVoiceSelector(!showVoiceSelector)}
                className="flex-1 flex items-center justify-between bg-background-dark text-white text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors text-left"
              >
                <span className="truncate">{VOZES.find(v => v.id === voz)?.name}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showVoiceSelector ? 'rotate-180' : ''}`} />
              </button>
              <button
                onClick={() => playVoicePreview(voz)}
                className={`px-1.5 py-1 rounded transition-colors ${
                  isPlayingVoice === voz
                    ? 'bg-orange-500 text-white'
                    : 'bg-background-dark hover:bg-white/10 text-orange-400'
                }`}
                title="Ouvir preview"
              >
                {isPlayingVoice === voz ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
            </div>
            {showVoiceSelector && (
              <div className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-background-dark rounded shadow-lg">
                {VOZES.map((v) => (
                  <div
                    key={v.id}
                    className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-colors ${
                      voz === v.id ? 'bg-orange-500/20' : 'hover:bg-white/10'
                    }`}
                    onClick={() => { setVoz(v.id); setShowVoiceSelector(false); }}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); playVoicePreview(v.id); }}
                      className={`p-1 rounded transition-colors flex-shrink-0 ${
                        isPlayingVoice === v.id
                          ? 'bg-orange-500 text-white'
                          : 'hover:bg-white/10 text-orange-400'
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
          <div ref={el => dropdownRefs.current['estilo'] = el} className="bg-background-dark-alt/50 rounded-lg p-2 relative">
            <label className="text-[10px] font-medium text-orange-400 mb-1 flex items-center gap-1">
              <Image className="w-3 h-3" /> Estilo
            </label>
            <button
              onClick={() => setOpenDropdown(openDropdown === 'estilo' ? null : 'estilo')}
              className="w-full flex items-center justify-between bg-background-dark text-white text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors"
            >
              <span>{ESTILOS.find(e => e.id === estilo)?.name}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${openDropdown === 'estilo' ? 'rotate-180' : ''}`} />
            </button>
            {openDropdown === 'estilo' && (
              <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-background-dark rounded shadow-lg">
                {ESTILOS.map((e) => (
                  <div
                    key={e.id}
                    className={`px-2 py-1.5 text-xs cursor-pointer transition-colors ${estilo === e.id ? 'bg-orange-500/20 text-orange-400' : 'text-white hover:bg-white/10'}`}
                    onClick={() => { setEstilo(e.id); setOpenDropdown(null); }}
                  >
                    {e.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Aspecto */}
          <div ref={el => dropdownRefs.current['aspecto'] = el} className="bg-background-dark-alt/50 rounded-lg p-2 relative">
            <label className="text-[10px] font-medium text-orange-400 mb-1 flex items-center gap-1">
              <ImageIcon className="w-3 h-3" /> Aspecto
            </label>
            <button
              onClick={() => setOpenDropdown(openDropdown === 'aspecto' ? null : 'aspecto')}
              className="w-full flex items-center justify-between bg-background-dark text-white text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors"
            >
              <span>{ASPECTOS.find(a => a.id === aspecto)?.name}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${openDropdown === 'aspecto' ? 'rotate-180' : ''}`} />
            </button>
            {openDropdown === 'aspecto' && (
              <div className="absolute z-50 left-0 right-0 mt-1 bg-background-dark rounded shadow-lg overflow-hidden">
                {ASPECTOS.map((a) => (
                  <div
                    key={a.id}
                    className={`px-2 py-1.5 text-xs cursor-pointer transition-colors ${aspecto === a.id ? 'bg-orange-500/20 text-orange-400' : 'text-white hover:bg-white/10'}`}
                    onClick={() => { setAspecto(a.id); setOpenDropdown(null); }}
                  >
                    {a.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tamanho Roteiro */}
          <div ref={el => dropdownRefs.current['roteiro'] = el} className="bg-background-dark-alt/50 rounded-lg p-2 relative">
            <label className="text-[10px] font-medium text-orange-400 mb-1 flex items-center gap-1">
              <FileText className="w-3 h-3" /> Roteiro
            </label>
            <button
              onClick={() => setOpenDropdown(openDropdown === 'roteiro' ? null : 'roteiro')}
              className="w-full flex items-center justify-between bg-background-dark text-white text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors"
            >
              <span>{TAMANHOS_ROTEIRO.find(t => t.id === tamanhoRoteiro)?.name}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${openDropdown === 'roteiro' ? 'rotate-180' : ''}`} />
            </button>
            {openDropdown === 'roteiro' && (
              <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-background-dark rounded shadow-lg">
                {TAMANHOS_ROTEIRO.map((t) => (
                  <div
                    key={t.id}
                    className={`px-2 py-1.5 text-xs cursor-pointer transition-colors ${tamanhoRoteiro === t.id ? 'bg-orange-500/20 text-orange-400' : 'text-white hover:bg-white/10'}`}
                    onClick={() => { setTamanhoRoteiro(t.id); setOpenDropdown(null); }}
                  >
                    {t.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Qtd Imagens */}
          <div ref={el => dropdownRefs.current['imagens'] = el} className="bg-background-dark-alt/50 rounded-lg p-2 relative">
            <label className="text-[10px] font-medium text-orange-400 mb-1 flex items-center gap-1">
              <ImageIcon className="w-3 h-3" /> Imagens
            </label>
            <button
              onClick={() => gerarImagens && setOpenDropdown(openDropdown === 'imagens' ? null : 'imagens')}
              className={`w-full flex items-center justify-between bg-background-dark text-white text-xs px-2 py-1 rounded transition-colors ${gerarImagens ? 'hover:bg-white/10' : 'opacity-50 cursor-not-allowed'}`}
            >
              <span>{QTD_IMAGENS.find(q => q.id === qtdImagens)?.name}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${openDropdown === 'imagens' ? 'rotate-180' : ''}`} />
            </button>
            {openDropdown === 'imagens' && gerarImagens && (
              <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-background-dark rounded shadow-lg">
                {QTD_IMAGENS.map((q) => (
                  <div
                    key={q.id}
                    className={`px-2 py-1.5 text-xs cursor-pointer transition-colors ${qtdImagens === q.id ? 'bg-orange-500/20 text-orange-400' : 'text-white hover:bg-white/10'}`}
                    onClick={() => { setQtdImagens(q.id); setOpenDropdown(null); }}
                  >
                    {q.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Gerar Imagens Checkbox */}
        <div className="bg-background-dark-alt/50 rounded-lg p-2.5 ">
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
        <div className="bg-background-dark-alt/50 rounded-lg p-2.5 ">
          <label className="text-xs font-medium text-orange-400 mb-1.5 flex items-center gap-1.5">
            <FolderOpen className="w-3 h-3" /> Pasta de Saida
          </label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={pastaSaida}
              readOnly
              placeholder="Selecione..."
              className="flex-1 bg-background-dark text-white text-xs px-2 py-1.5 rounded outline-none truncate cursor-pointer hover:bg-white/5 transition-colors"
              onClick={selectOutputFolder}
            />
            <button
              onClick={selectOutputFolder}
              className="px-2 py-1.5 bg-background-dark hover:bg-border-light text-white text-xs rounded transition-colors "
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
            className="bg-orange-500/10 rounded-lg p-2.5"
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
            className="bg-green-500/10 rounded-lg p-2.5"
          >
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-xs text-green-400 font-bold">Concluido!</span>
            </div>
            <div className="text-[10px] text-green-400/70 space-y-0.5">
              <p>Roteiro: {result.scriptLength} chars {result.modoRoteiro ? `(${result.scriptParts} partes)` : ''}</p>
              {result.imagesSkipped ? (
                <p>Prompts: {result.promptsSaved} (imagens nao geradas)</p>
              ) : (
                <p>Imagens: {result.imagesGenerated}/{result.imagesRequested}</p>
              )}
              <p>Audio: {result.audioPartsOk}/{result.audioPartsTotal}</p>
              {result.srtGenerated && <p>SRT: legendas.srt gerado</p>}
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
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs rounded transition-colors"
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

        {/* Generate / Stop Button */}
        {isGenerating ? (
          <button
            onClick={cancelGeneration}
            disabled={isCancelling}
            className={`
              w-full py-2.5 rounded-lg font-bold text-white text-sm transition-all flex items-center justify-center gap-2
              ${isCancelling
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg hover:shadow-red-500/25'
              }
            `}
          >
            {isCancelling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Cancelando...
              </>
            ) : (
              <>
                <Square className="w-4 h-4" />
                PARAR GERACAO
              </>
            )}
          </button>
        ) : (
          <button
            onClick={startGeneration}
            className="w-full py-2.5 rounded-lg font-bold text-white text-sm transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg hover:shadow-orange-500/25"
          >
            <Sparkles className="w-4 h-4" />
            GERAR CONTEUDO
          </button>
        )}
      </div>

      {/* RIGHT SIDE - Preview */}
      <div className="flex-1 flex flex-col gap-3 overflow-hidden">
        {/* Preview Header */}
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-medium text-white">Preview do Conteudo</span>
        </div>

        {!result && !isGenerating ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center bg-background-dark-alt/30 rounded-lg">
            <Sparkles className="w-12 h-12 text-orange-500/30 mb-3" />
            <p className="text-sm text-text-muted">Gere conteudo para visualizar</p>
            <p className="text-xs text-text-muted/50 mt-1">Roteiro, imagens e audio aparecerao aqui</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-3 overflow-hidden">
            {/* Script Preview */}
            <div className="flex-1 min-h-0 bg-background-dark-alt/50 rounded-lg  flex flex-col overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2  bg-background-dark/50">
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
            <div className="h-36 bg-background-dark-alt/50 rounded-lg  flex flex-col overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2  bg-background-dark/50">
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
                        className="h-full w-auto rounded  object-cover"
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
              <div className="bg-background-dark-alt/50 rounded-lg  flex flex-col overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2  bg-background-dark/50">
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
                                : 'bg-background-dark '
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

      {/* Modal do Editor Expandido */}
      {expandedEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-[85%] h-[85%] bg-background-dark rounded-xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-background-dark-alt/50">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-medium text-white">
                  {expandedEditor === 'instrucoes' ? 'Instruções Opcionais' : 'Roteiro Completo'}
                </span>
              </div>
              <button
                onClick={() => setExpandedEditor(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-white transition-colors"
                title="Fechar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Editor */}
            <div className="flex-1 p-4">
              <textarea
                value={expandedEditor === 'instrucoes' ? instrucoes : roteiroCompleto}
                onChange={(e) => {
                  if (expandedEditor === 'instrucoes') {
                    setInstrucoes(e.target.value)
                  } else {
                    setRoteiroCompleto(e.target.value)
                  }
                }}
                placeholder={expandedEditor === 'instrucoes'
                  ? 'Digite instruções adicionais para a IA...'
                  : 'Cole aqui seu roteiro completo. O sistema vai dividir automaticamente respeitando as pontuações...'}
                className="w-full h-full bg-background-dark-alt/30 text-white text-sm p-4 rounded-lg outline-none resize-none focus:ring-1 focus:ring-orange-500/50"
                autoFocus
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 bg-background-dark-alt/50">
              <div className="text-xs text-text-muted">
                {expandedEditor === 'roteiro' && roteiroCompleto && (
                  <span>{roteiroCompleto.length} caracteres | ~{Math.ceil(roteiroCompleto.length / parseInt(tamanhoChunk))} partes</span>
                )}
                {expandedEditor === 'instrucoes' && instrucoes && (
                  <span>{instrucoes.length} caracteres</span>
                )}
              </div>
              <button
                onClick={() => setExpandedEditor(null)}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Concluir
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
