import { motion } from 'motion/react'
import type { ReactNode } from 'react'

type LandingRevealProps = {
  className?: string
  children: ReactNode
  delay?: number
}

export function LandingReveal({ children, className, delay = 0 }: LandingRevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      transition={{ duration: 0.58, delay, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ amount: 0.2, once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {children}
    </motion.div>
  )
}
