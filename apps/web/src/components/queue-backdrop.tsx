import { motion } from 'motion/react'

type QueueBackdropProps = {
  reducedMotion: boolean
  variant: 'hero' | 'workflows' | 'footer'
}

const route = 'M 1010 38 C 830 38 840 142 650 142 S 500 270 335 270 S 145 390 -25 390'
const workflowRoute = 'M 1035 0 C 830 45 930 105 1020 150 S 855 260 980 320 S 900 390 1035 430'
const footerRoute = 'M 1030 10 C 840 48 930 82 1030 116 S 875 178 1030 220'

function TicketSlip({
  delay,
  reducedMotion,
  x,
  y,
}: {
  delay: number
  reducedMotion: boolean
  x: number
  y: number
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <motion.g
        animate={reducedMotion ? { y: 0 } : { y: [0, -3, 0] }}
        initial={false}
        transition={{
          duration: 4.8,
          delay,
          ease: 'easeInOut',
          repeat: reducedMotion ? 0 : Infinity,
        }}
      >
        <path
          d="M7 0h82a7 7 0 0 1 7 7v4a6 6 0 0 0 0 12v4a7 7 0 0 1-7 7H7a7 7 0 0 1-7-7v-4a6 6 0 0 0 0-12V7a7 7 0 0 1 7-7Z"
          fill="var(--background)"
          fillOpacity="0.84"
          stroke="var(--border)"
          strokeWidth="1.3"
        />
        <circle cx="18" cy="17" r="3.2" fill="var(--brand-green)" />
        <path
          d="M31 13h43M31 20h29"
          stroke="var(--muted-foreground)"
          strokeLinecap="round"
          strokeOpacity="0.55"
          strokeWidth="1.5"
        />
      </motion.g>
    </g>
  )
}

export function QueueBackdrop({ reducedMotion, variant }: QueueBackdropProps) {
  const className = {
    hero: 'right-0 top-0 hidden h-full w-[67%] opacity-55 lg:block',
    workflows: 'right-0 top-0 hidden h-full w-[54%] opacity-60 md:block',
    footer: 'bottom-0 right-0 hidden h-full w-[45%] opacity-50 sm:block',
  }[variant]
  const path = variant === 'workflows' ? workflowRoute : variant === 'footer' ? footerRoute : route

  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none absolute ${className}`}
      fill="none"
      preserveAspectRatio="none"
      viewBox="0 0 1000 430"
    >
      <path d={path} stroke="var(--border)" strokeWidth="1.4" />
      <motion.path
        animate={reducedMotion ? { strokeDashoffset: 0 } : { strokeDashoffset: [0, -108] }}
        d={path}
        opacity="0.52"
        stroke="var(--brand-green)"
        strokeDasharray="2 17"
        strokeLinecap="round"
        strokeWidth="1.8"
        transition={{ duration: 16, ease: 'linear', repeat: reducedMotion ? 0 : Infinity }}
      />

      {variant === 'hero' ? (
        <>
          <TicketSlip delay={0} reducedMotion={reducedMotion} x={725} y={46} />
          <TicketSlip delay={0.7} reducedMotion={reducedMotion} x={420} y={164} />
          <TicketSlip delay={1.4} reducedMotion={reducedMotion} x={120} y={310} />
          <motion.circle
            animate={
              reducedMotion
                ? { cx: 650, cy: 142 }
                : {
                    cx: [1010, 850, 760, 650, 560, 440, 335, 230, 145, 50, -25],
                    cy: [38, 42, 100, 142, 166, 238, 270, 332, 390, 390, 390],
                  }
            }
            fill="var(--brand-green)"
            r="4.2"
            stroke="var(--background)"
            strokeWidth="3"
            transition={{ duration: 20, ease: 'linear', repeat: reducedMotion ? 0 : Infinity }}
          />
        </>
      ) : null}

      {variant === 'workflows' ? (
        <>
          <TicketSlip delay={0} reducedMotion={reducedMotion} x={895} y={42} />
          <TicketSlip delay={0.6} reducedMotion={reducedMotion} x={925} y={188} />
          <TicketSlip delay={1.2} reducedMotion={reducedMotion} x={890} y={330} />
          <circle
            cx="925"
            cy="150"
            fill="var(--background)"
            r="5"
            stroke="var(--border)"
            strokeWidth="1.5"
          />
          <circle
            cx="980"
            cy="320"
            fill="var(--background)"
            r="5"
            stroke="var(--border)"
            strokeWidth="1.5"
          />
        </>
      ) : null}

      {variant === 'footer' ? (
        <>
          <TicketSlip delay={0} reducedMotion={reducedMotion} x={875} y={36} />
          <TicketSlip delay={0.5} reducedMotion={reducedMotion} x={910} y={112} />
          <TicketSlip delay={1} reducedMotion={reducedMotion} x={875} y={188} />
          <motion.circle
            animate={reducedMotion ? { cy: 142 } : { cy: [65, 142, 205, 142, 65] }}
            cx="860"
            fill="var(--brand-green)"
            r="3.5"
            transition={{ duration: 8, ease: 'easeInOut', repeat: reducedMotion ? 0 : Infinity }}
          />
        </>
      ) : null}
    </svg>
  )
}
