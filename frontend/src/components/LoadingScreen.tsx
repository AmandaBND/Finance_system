import { motion } from 'framer-motion'

type Props = {
  title?: string
  subtitle?: string
}

export default function LoadingScreen({ title = 'Setting up your workspace…', subtitle }: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#F8FAFC]">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center px-6"
      >
        <div className="w-12 h-12 border-4 border-[#1E3A5F]/20 border-t-[#3B82F6] rounded-full animate-spin mx-auto mb-6" />
        <p className="text-lg font-semibold text-[#1E3A5F]">{title}</p>
        {subtitle && <p className="text-sm text-slate-500 mt-2">{subtitle}</p>}
      </motion.div>
    </div>
  )
}
