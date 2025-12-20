import { motion } from 'framer-motion'

export default function LoadingScreen() {
  return (
    <div className="h-screen w-screen bg-hero-gradient flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        {/* Logo */}
        <motion.div
          animate={{
            boxShadow: [
              '0 0 20px rgba(232, 90, 42, 0.3)',
              '0 0 40px rgba(232, 90, 42, 0.5)',
              '0 0 20px rgba(232, 90, 42, 0.3)',
            ]
          }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-cta-gradient flex items-center justify-center"
        >
          <span className="text-3xl font-bold text-white">⚡</span>
        </motion.div>

        <h1 className="text-2xl font-heading text-white mb-2">CapCut Sync Pro</h1>
        <p className="text-text-secondary text-sm">Carregando...</p>

        {/* Loading dots */}
        <div className="flex justify-center gap-1 mt-6">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              className="w-2 h-2 rounded-full bg-primary"
            />
          ))}
        </div>
      </motion.div>
    </div>
  )
}
