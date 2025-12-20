import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap, RefreshCw, FileText, FolderOpen, MousePointer, Undo2, Clock, CheckCircle, AlertTriangle, Music, Film, Play } from 'lucide-react'

interface HelpModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-4 md:inset-10 bg-background-dark border border-border-light rounded-xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border-light">
              <h2 className="text-lg font-bold text-white">Como usar o CapCut Sync Pro</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 space-y-6">
              {/* Introdução */}
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                <h4 className="text-primary font-semibold mb-2">Bem-vindo ao CapCut Sync Pro!</h4>
                <p className="text-text-secondary text-sm">
                  Esta ferramenta automatiza tarefas repetitivas no CapCut, como sincronizar mídias com áudio,
                  repetir vídeos/imagens em loop e inserir legendas .srt. <strong className="text-white">Economize horas de trabalho manual!</strong>
                </p>
              </div>

              {/* Passo a Passo */}
              <h3 className="text-white font-bold text-lg border-b border-border-light pb-2">Passo a Passo</h3>

              {/* Passo 1 */}
              <div className="card p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <FolderOpen className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold mb-1">1. Selecione o Projeto CapCut</h3>
                    <p className="text-text-secondary text-sm mb-3">
                      Clique em <span className="bg-white/10 px-2 py-0.5 rounded text-white">Selecionar Projeto</span> e navegue até a pasta do seu projeto CapCut.
                    </p>
                    <div className="bg-white/5 rounded-lg p-3 space-y-2">
                      <p className="text-xs text-text-muted">
                        <strong className="text-yellow-400">Onde encontrar:</strong> A pasta do projeto geralmente fica em:
                      </p>
                      <code className="text-xs bg-black/30 px-2 py-1 rounded block text-green-400">
                        C:\Users\SeuUsuario\AppData\Local\CapCut\User Data\Projects\com.lveditor.draft\NomeDoProjeto
                      </code>
                      <p className="text-xs text-text-muted">
                        A pasta deve conter o arquivo <code className="text-primary">draft_content.json</code>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Passo 2 */}
              <div className="card p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Play className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold mb-1">2. Análise Automática</h3>
                    <p className="text-text-secondary text-sm mb-2">
                      Ao selecionar a pasta, o projeto é <strong className="text-white">analisado automaticamente</strong>.
                      O preview da timeline mostrará todas as tracks (vídeo, áudio, legendas, efeitos).
                    </p>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span>As cores das tracks correspondem às cores do CapCut</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Passo 3 */}
              <div className="card p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <MousePointer className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold mb-1">3. Selecione a Referência</h3>
                    <p className="text-text-secondary text-sm mb-2">
                      <strong className="text-white">Clique em qualquer track de áudio</strong> no preview para selecioná-la como referência.
                      A track selecionada ficará destacada com "REF".
                    </p>
                    <p className="text-xs text-text-muted">
                      A duração desta track será usada como base para sincronização e loops.
                    </p>
                  </div>
                </div>
              </div>

              {/* Funcionalidades */}
              <h3 className="text-white font-bold text-lg pt-4 border-t border-border-light">Funcionalidades Detalhadas</h3>

              {/* SYNC */}
              <div className="card p-4" style={{ borderLeft: '3px solid #175d62' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#175d6230' }}>
                    <Zap className="w-5 h-5" style={{ color: '#175d62' }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold mb-2">SYNC - Sincronizar Mídia</h3>
                    <p className="text-text-secondary text-sm mb-3">
                      Sincroniza a duração de vídeos e imagens com a faixa de áudio de referência.
                    </p>

                    <div className="space-y-3">
                      <div className="bg-white/5 rounded-lg p-3">
                        <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                          <Music className="w-4 h-4" style={{ color: '#0e3058' }} />
                          Modo Áudio
                        </h4>
                        <p className="text-xs text-text-muted">
                          Cada segmento de vídeo/imagem será ajustado para ter a mesma duração do segmento de áudio correspondente.
                          Ideal para quando você tem um áudio com várias partes e quer que as imagens acompanhem cada parte.
                        </p>
                      </div>

                      <div className="bg-white/5 rounded-lg p-3">
                        <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                          <FileText className="w-4 h-4" style={{ color: '#9c4937' }} />
                          Modo Legenda
                        </h4>
                        <p className="text-xs text-text-muted">
                          Sincroniza baseado nas legendas existentes. Cada imagem corresponderá à duração de uma legenda.
                          Perfeito para apresentações com texto sincronizado.
                        </p>
                      </div>

                      <div className="flex items-start gap-2 text-xs text-text-muted mt-2">
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                        <span><strong className="text-white">Sincronizar Legendas:</strong> Quando ativado, também ajusta a posição das legendas para acompanhar as mudanças.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* LOOP */}
              <div className="card p-4" style={{ borderLeft: '3px solid #0e3058' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#0e305830' }}>
                    <RefreshCw className="w-5 h-5" style={{ color: '#0e3058' }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold mb-2">LOOP - Repetição</h3>
                    <p className="text-text-secondary text-sm mb-3">
                      Repete automaticamente vídeos/imagens ou trilhas musicais até preencher a duração desejada.
                    </p>

                    <div className="space-y-3">
                      <div className="bg-white/5 rounded-lg p-3">
                        <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                          <Film className="w-4 h-4" style={{ color: '#175d62' }} />
                          Loop Vídeo/Imagem
                        </h4>
                        <ul className="text-xs text-text-muted space-y-1">
                          <li><strong className="text-white">Sequencial:</strong> Repete na mesma ordem (1, 2, 3, 1, 2, 3...)</li>
                          <li><strong className="text-white">Aleatório:</strong> Repete em ordem aleatória para mais variedade</li>
                        </ul>
                        <p className="text-xs text-yellow-400 mt-2">
                          Usa a duração da track de áudio de referência como limite.
                        </p>
                      </div>

                      <div className="bg-white/5 rounded-lg p-3">
                        <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                          <Music className="w-4 h-4" style={{ color: '#0e3058' }} />
                          Loop Trilha Musical
                        </h4>
                        <p className="text-xs text-text-muted">
                          Selecione uma track de áudio e ela será repetida até cobrir toda a duração do projeto.
                          Perfeito para músicas de fundo que são mais curtas que o vídeo.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SRT */}
              <div className="card p-4" style={{ borderLeft: '3px solid #9c4937' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#9c493730' }}>
                    <FileText className="w-5 h-5" style={{ color: '#9c4937' }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold mb-2">SRT - Inserir Legendas</h3>
                    <p className="text-text-secondary text-sm mb-3">
                      Importa arquivos de legenda .srt diretamente para a timeline do CapCut.
                    </p>

                    <div className="bg-white/5 rounded-lg p-3 space-y-2">
                      <h4 className="text-sm font-medium text-white">Como funciona:</h4>
                      <ol className="text-xs text-text-muted space-y-1 list-decimal list-inside">
                        <li>Coloque os arquivos .srt em uma pasta</li>
                        <li>Os nomes devem corresponder aos áudios (ex: <code className="text-green-400">Audio01.srt</code> para <code className="text-green-400">Audio01.mp3</code>)</li>
                        <li>Selecione a pasta e clique em "Inserir Legendas"</li>
                        <li>As legendas serão inseridas na timeline do projeto</li>
                      </ol>
                      <div className="flex items-start gap-2 text-xs text-text-muted mt-2">
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                        <span><strong className="text-white">Criar título:</strong> Adiciona o nome do arquivo como texto de título antes das legendas.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recursos Extras */}
              <h3 className="text-white font-bold text-lg pt-4 border-t border-border-light">Recursos Extras</h3>

              {/* Desfazer */}
              <div className="card p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                    <Undo2 className="w-4 h-4 text-yellow-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Desfazer Modificações</h3>
                    <p className="text-text-secondary text-sm">
                      Cada operação cria um backup automático. Se algo der errado, clique no botão
                      <span className="bg-yellow-400/20 text-yellow-400 px-2 py-0.5 rounded mx-1">Desfazer</span>
                      para restaurar o projeto ao estado anterior.
                    </p>
                  </div>
                </div>
              </div>

              {/* Dicas Importantes */}
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <h4 className="text-red-400 font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Dicas Importantes
                </h4>
                <ul className="text-text-secondary text-sm space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 font-bold">1.</span>
                    <span><strong className="text-white">FECHE O CAPCUT</strong> antes de usar esta ferramenta! Se o CapCut estiver aberto, as modificações podem não ser salvas corretamente.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 font-bold">2.</span>
                    <span>Após modificar, <strong className="text-white">reabra o projeto no CapCut</strong> para ver as alterações.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 font-bold">3.</span>
                    <span>Mantenha backups importantes antes de fazer modificações em massa.</span>
                  </li>
                </ul>
              </div>

              {/* Fluxo de Trabalho */}
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <h4 className="text-green-400 font-semibold mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Fluxo de Trabalho Recomendado
                </h4>
                <div className="flex items-center gap-2 text-sm text-text-secondary flex-wrap">
                  <span className="bg-white/10 px-2 py-1 rounded">1. Fechar CapCut</span>
                  <span className="text-text-muted">→</span>
                  <span className="bg-white/10 px-2 py-1 rounded">2. Selecionar Projeto</span>
                  <span className="text-text-muted">→</span>
                  <span className="bg-white/10 px-2 py-1 rounded">3. Executar Ação</span>
                  <span className="text-text-muted">→</span>
                  <span className="bg-white/10 px-2 py-1 rounded">4. Reabrir CapCut</span>
                  <span className="text-text-muted">→</span>
                  <span className="bg-green-400/20 text-green-400 px-2 py-1 rounded">5. Verificar Resultado</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border-light flex justify-between items-center">
              <span className="text-xs text-text-muted">
                Desenvolvido por <span className="text-primary">Nardoto</span>
              </span>
              <button
                onClick={onClose}
                className="btn-primary py-2 px-6"
              >
                Entendi!
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
