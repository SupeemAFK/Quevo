import { motion } from 'motion/react'

type QueueBackdropProps = {
  reducedMotion: boolean
  variant: 'hero' | 'workflows' | 'footer' | 'login'
}

const route = 'M 1010 38 C 830 38 840 142 650 142 S 500 270 335 270 S 145 390 -25 390'
const footerRoute = 'M 1030 10 C 840 48 930 82 1030 116 S 875 178 1030 220'
const workflowFlow = 'M -80 650 C 150 600 170 270 415 290 S 650 650 860 480 S 1120 110 1510 190'
const workflowReturn = 'M -70 230 C 210 100 300 510 570 540 S 940 250 1100 365 S 1310 630 1510 570'
const loginFlow = 'M -80 740 C 180 670 230 340 470 350 S 770 690 940 490 S 1190 140 1520 200'
const loginReturn = 'M -60 210 C 190 100 340 470 590 500 S 900 240 1080 330 S 1300 620 1500 580'

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
    workflows: 'inset-0 h-full w-full opacity-40',
    footer: 'bottom-0 right-0 hidden h-full w-[45%] opacity-50 sm:block',
    login: 'inset-0 h-full w-full opacity-40',
  }[variant]
  const isFullBleed = variant === 'workflows' || variant === 'login'
  const path = {
    hero: route,
    workflows: workflowFlow,
    footer: footerRoute,
    login: loginFlow,
  }[variant]

  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none absolute ${className}`}
      fill="none"
      preserveAspectRatio={isFullBleed ? 'xMidYMid slice' : 'none'}
      viewBox={isFullBleed ? '0 0 1440 820' : '0 0 1000 430'}
    >
      <path
        d={path}
        opacity={isFullBleed ? '0.82' : '1'}
        stroke="var(--border)"
        strokeWidth={isFullBleed ? '1.6' : '1.4'}
      />
      <motion.path
        animate={reducedMotion ? { strokeDashoffset: 0 } : { strokeDashoffset: [0, -108] }}
        d={path}
        opacity={isFullBleed ? '0.38' : '0.52'}
        stroke="var(--brand-green)"
        strokeDasharray="2 17"
        strokeLinecap="round"
        strokeWidth="1.8"
        transition={{ duration: 16, ease: 'linear', repeat: reducedMotion ? 0 : Infinity }}
      />

      {variant === 'workflows' ? (
        <>
          <path d={workflowReturn} opacity="0.56" stroke="var(--border)" strokeWidth="1.2" />
          <motion.path
            animate={reducedMotion ? { strokeDashoffset: 0 } : { strokeDashoffset: [0, 126] }}
            d={workflowReturn}
            opacity="0.27"
            stroke="var(--brand-green)"
            strokeDasharray="2 21"
            strokeLinecap="round"
            strokeWidth="1.8"
            transition={{ duration: 20, ease: 'linear', repeat: reducedMotion ? 0 : Infinity }}
          />
          <circle
            cx="205"
            cy="590"
            fill="var(--background)"
            r="7"
            stroke="var(--border)"
            strokeWidth="1.6"
          />
          <circle
            cx="570"
            cy="540"
            fill="var(--background)"
            r="7"
            stroke="var(--border)"
            strokeWidth="1.6"
          />
          <circle
            cx="1100"
            cy="365"
            fill="var(--background)"
            r="7"
            stroke="var(--border)"
            strokeWidth="1.6"
          />
          <TicketSlip delay={0} reducedMotion={reducedMotion} x={92} y={152} />
          <TicketSlip delay={0.8} reducedMotion={reducedMotion} x={640} y={700} />
          <TicketSlip delay={1.6} reducedMotion={reducedMotion} x={1190} y={110} />
          <motion.circle
            animate={
              reducedMotion
                ? { cx: 860, cy: 480 }
                : {
                    cx: [0, 205, 415, 570, 860, 1100, 1440],
                    cy: [650, 590, 290, 540, 480, 365, 190],
                  }
            }
            fill="var(--brand-green)"
            r="4.5"
            stroke="var(--background)"
            strokeWidth="3"
            transition={{ duration: 24, ease: 'linear', repeat: reducedMotion ? 0 : Infinity }}
          />
        </>
      ) : null}

      {variant === 'login' ? (
        <>
          <path d={loginReturn} opacity="0.56" stroke="var(--border)" strokeWidth="1.2" />
          <motion.path
            animate={reducedMotion ? { strokeDashoffset: 0 } : { strokeDashoffset: [0, -132] }}
            d={loginReturn}
            opacity="0.34"
            stroke="var(--brand-green)"
            strokeDasharray="2 20"
            strokeLinecap="round"
            strokeWidth="1.8"
            transition={{ duration: 21, ease: 'linear', repeat: reducedMotion ? 0 : Infinity }}
          />
          <TicketSlip delay={0} reducedMotion={reducedMotion} x={138} y={145} />
          <TicketSlip delay={0.9} reducedMotion={reducedMotion} x={730} y={715} />
          <TicketSlip delay={1.8} reducedMotion={reducedMotion} x={1210} y={180} />
          <motion.circle
            animate={
              reducedMotion
                ? { cx: 940, cy: 490 }
                : {
                    cx: [0, 210, 470, 700, 940, 1160, 1440],
                    cy: [740, 670, 350, 600, 490, 260, 200],
                  }
            }
            fill="var(--brand-green)"
            r="4.5"
            stroke="var(--background)"
            strokeWidth="3"
            transition={{ duration: 24, ease: 'linear', repeat: reducedMotion ? 0 : Infinity }}
          />
        </>
      ) : null}

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
