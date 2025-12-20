import { useEffect, useRef } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, Terminal } from 'lucide-react'
import type { LogEntry } from '../types'

interface LogConsoleProps {
  logs: LogEntry[]
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const colors = {
  success: 'text-green-400',
  error: 'text-red-400',
  warning: 'text-yellow-400',
  info: 'text-text-secondary',
}

export default function LogConsole({ logs }: LogConsoleProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  return (
    <div className="h-full flex flex-col bg-background-dark-alt">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-light flex items-center gap-2">
        <Terminal className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-white">LOG</span>
        <span className="text-xs text-text-muted ml-auto">{logs.length} entradas</span>
      </div>

      {/* Log entries */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-1 font-mono text-xs">
        {logs.map((log) => {
          const Icon = icons[log.type]
          return (
            <div
              key={log.id}
              className={`flex items-start gap-2 py-1 px-2 rounded hover:bg-white/5 ${colors[log.type]}`}
            >
              <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span className="flex-1 break-all">{log.message}</span>
              <span className="text-text-muted flex-shrink-0">{formatTime(log.timestamp)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
