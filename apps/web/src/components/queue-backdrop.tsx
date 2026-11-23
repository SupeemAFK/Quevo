import { useId } from 'react'
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion'

type QueueBackdropProps = {
  variant: 'hero' | 'workflows' | 'footer' | 'login'
}

const route = 'M 1010 38 C 830 38 840 142 650 142 S 500 270 335 270 S 145 390 -25 390'
const mobileHeroRoute = 'M 890 145 C 850 105 820 120 800 168 S 745 220 770 202'
const footerRoute = 'M 1030 10 C 840 48 930 82 1030 116 S 875 178 1030 220'
const workflowFlow = 'M -80 650 C 150 600 170 270 415 290 S 650 650 860 480 S 1120 110 1510 190'
const workflowReturn = 'M -70 230 C 210 100 300 510 570 540 S 940 250 1100 365 S 1310 630 1510 570'
const loginFlow = 'M -80 740 C 180 670 230 340 470 350 S 770 690 940 490 S 1190 140 1520 200'
const loginReturn = 'M -60 210 C 190 100 340 470 590 500 S 900 240 1080 330 S 1300 620 1500 580'
const cardShape =
  'M14 2h152a12 12 0 0 1 12 12v35a9 9 0 0 0 0 18v35a12 12 0 0 1-12 12H14A12 12 0 0 1 2 102V67a9 9 0 0 0 0-18V14A12 12 0 0 1 14 2Z'

function QueueCard({ id, animated }: { id: string; animated: boolean }) {
  const gradientId = `${id}-surface`
  const clipId = `${id}-clip`
  const shineId = `${id}-shine`

  return (
    <g filter="drop-shadow(0px 9px 9px rgb(0 0 0 / 16%))">
      <path d={cardShape} fill="var(--foreground)" fillOpacity="0.08" transform="translate(5 7)" />
      <path d={cardShape} fill={`url(#${gradientId})`} stroke="var(--border)" strokeWidth="1.5" />
      <path d="M18 13h145" stroke="var(--foreground)" strokeOpacity="0.08" strokeWidth="1" />
      <g clipPath={`url(#${clipId})`}>
        <path
          d="M20 24h10M20 28h7M20 32h10"
          stroke="var(--brand-green)"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
        <text
          fill="var(--muted-foreground)"
          fontFamily="var(--font-mono)"
          fontSize="7.5"
          fontWeight="600"
          letterSpacing="1.1"
          x="37"
          y="30"
        >
          QUEVO · QUEUE TICKET
        </text>
        <circle cx="151" cy="27" fill="var(--brand-green)" r="3.2" />
        <path d="M17 39h134" stroke="var(--border)" strokeDasharray="2 4" strokeWidth="1" />
        <text
          fill="var(--foreground)"
          fontFamily="var(--font-mono)"
          fontSize="35"
          fontWeight="650"
          letterSpacing="-2.4"
          x="18"
          y="80"
        >
          A12
        </text>
        <text
          fill="var(--muted-foreground)"
          fontFamily="var(--font-sans)"
          fontSize="8"
          fontWeight="600"
          letterSpacing="1.15"
          x="95"
          y="65"
        >
          YOUR PLACE
        </text>
        <path d="M96 74h48" stroke="var(--border)" strokeLinecap="round" strokeWidth="2" />
        <path d="M96 74h22" stroke="var(--brand-green)" strokeLinecap="round" strokeWidth="2" />
        <g fill="var(--muted-foreground)">
          <circle cx="97" cy="87" r="2" />
          <circle cx="107" cy="87" r="2" opacity="0.65" />
          <circle cx="117" cy="87" r="2" opacity="0.4" />
          <circle cx="127" cy="87" r="2" opacity="0.25" />
        </g>
        <path
          d="M-45 0h48l94 110H49z"
          fill={`url(#${shineId})`}
          opacity="0.8"
          transform={animated ? 'translate(-160 0)' : 'translate(34 0)'}
        >
          {animated ? (
            <animateTransform
              attributeName="transform"
              dur="5.8s"
              repeatCount="indefinite"
              type="translate"
              values="-160 0;240 0;240 0"
            />
          ) : null}
        </path>
      </g>
      <path
        d="M15 3.5h148"
        stroke="var(--foreground)"
        strokeOpacity="0.13"
        strokeLinecap="round"
        strokeWidth="1"
      />
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--card)" />
          <stop
            offset="52%"
            stopColor="color-mix(in srgb, var(--card) 84%, var(--foreground) 16%)"
          />
          <stop offset="100%" stopColor="var(--card)" />
        </linearGradient>
        <linearGradient id={shineId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="var(--foreground)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--foreground)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--foreground)" stopOpacity="0" />
        </linearGradient>
        <clipPath id={clipId}>
          <path d={cardShape} />
        </clipPath>
      </defs>
    </g>
  )
}

function TicketSlip({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
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
    </g>
  )
}

export function QueueBackdrop({ variant }: QueueBackdropProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const id = useId().replaceAll(':', '')
  const className = {
    hero: 'inset-x-0 top-[9%] h-auto w-full aspect-[1000/430] opacity-70 sm:top-[8%] lg:inset-y-0 lg:left-[33%] lg:right-0 lg:top-0 lg:h-full lg:w-[67%] lg:aspect-auto lg:opacity-70',
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
      preserveAspectRatio={isFullBleed || variant === 'hero' ? 'xMidYMid meet' : 'none'}
      viewBox={isFullBleed ? '0 0 1440 820' : '0 0 1000 430'}
    >
      {variant === 'hero' ? (
        <>
          <path
            className="lg:hidden"
            d={mobileHeroRoute}
            opacity="0.9"
            stroke="var(--border)"
            strokeWidth="1.4"
          />
          <path className="hidden lg:block" d={path} stroke="var(--border)" strokeWidth="1.4" />
          <path
            className="queue-flow-dashes lg:hidden"
            d={mobileHeroRoute}
            opacity="0.58"
            stroke="var(--brand-green)"
            strokeDasharray="4 19"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
          <path
            className="queue-flow-dashes hidden lg:block"
            d={path}
            opacity="0.52"
            stroke="var(--brand-green)"
            strokeDasharray="4 19"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </>
      ) : (
        <>
          <path
            d={path}
            opacity={isFullBleed ? '0.82' : '1'}
            stroke="var(--border)"
            strokeWidth={isFullBleed ? '1.6' : '1.4'}
          />
          <path
            className="queue-flow-dashes"
            d={path}
            opacity={isFullBleed ? '0.38' : '0.52'}
            stroke="var(--brand-green)"
            strokeDasharray="4 19"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </>
      )}

      <g opacity="0.97">
        {prefersReducedMotion ? (
          variant === 'hero' ? (
            <>
              <g className="lg:hidden" transform="translate(820 190) rotate(-12)">
                <g transform="scale(1.25)">
                  <QueueCard animated={false} id={`${id}-mobile`} />
                </g>
              </g>
              <g className="hidden lg:block" transform="translate(690 176) rotate(-12)">
                <QueueCard animated={false} id={`${id}-desktop`} />
              </g>
            </>
          ) : (
            <g transform="translate(690 176) rotate(-12)">
              <QueueCard animated={false} id={id} />
            </g>
          )
        ) : variant === 'hero' ? (
          <>
            <g className="lg:hidden">
              <animateMotion dur="8s" path={mobileHeroRoute} repeatCount="indefinite" rotate="0" />
              <g>
                <animateTransform
                  attributeName="transform"
                  dur="4.6s"
                  repeatCount="indefinite"
                  type="rotate"
                  values="-14 0 0;14 0 0;-14 0 0"
                />
                <g transform="scale(1.25)">
                  <g transform="translate(-90 -52)">
                    <QueueCard animated id={`${id}-mobile`} />
                  </g>
                </g>
              </g>
            </g>
            <g className="hidden lg:block">
              <animateMotion dur="22s" path={path} repeatCount="indefinite" rotate="0" />
              <g>
                <animateTransform
                  attributeName="transform"
                  dur="4.6s"
                  repeatCount="indefinite"
                  type="rotate"
                  values="-12 0 0;12 0 0;-12 0 0"
                />
                <g transform="translate(-90 -52)">
                  <QueueCard animated id={`${id}-desktop`} />
                </g>
              </g>
            </g>
          </>
        ) : (
          <g>
            <animateMotion dur="22s" path={path} repeatCount="indefinite" rotate="0" />
            <g>
              <animateTransform
                attributeName="transform"
                dur="4.6s"
                repeatCount="indefinite"
                type="rotate"
                values="-12 0 0;12 0 0;-12 0 0"
              />
              <g transform="translate(-90 -52)">
                <QueueCard animated id={id} />
              </g>
            </g>
          </g>
        )}
      </g>

      {variant === 'workflows' ? (
        <>
          <path d={workflowReturn} opacity="0.56" stroke="var(--border)" strokeWidth="1.2" />
          <path
            d={workflowReturn}
            opacity="0.27"
            stroke="var(--brand-green)"
            strokeDasharray="2 21"
            strokeLinecap="round"
            strokeWidth="1.8"
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
          <TicketSlip x={92} y={152} />
          <TicketSlip x={640} y={700} />
          <TicketSlip x={1190} y={110} />
          <circle
            cx="860"
            cy="480"
            fill="var(--brand-green)"
            r="4.5"
            stroke="var(--background)"
            strokeWidth="3"
          />
        </>
      ) : null}

      {variant === 'login' ? (
        <>
          <path d={loginReturn} opacity="0.56" stroke="var(--border)" strokeWidth="1.2" />
          <path
            d={loginReturn}
            opacity="0.34"
            stroke="var(--brand-green)"
            strokeDasharray="2 20"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
          <TicketSlip x={138} y={145} />
          <TicketSlip x={730} y={715} />
          <TicketSlip x={1210} y={180} />
          <circle
            cx="940"
            cy="490"
            fill="var(--brand-green)"
            r="4.5"
            stroke="var(--background)"
            strokeWidth="3"
          />
        </>
      ) : null}

      {variant === 'hero' ? (
        <g className="hidden lg:block">
          <TicketSlip x={725} y={46} />
          <TicketSlip x={420} y={164} />
          <TicketSlip x={120} y={310} />
          <circle
            cx="650"
            cy="142"
            fill="var(--brand-green)"
            r="4.2"
            stroke="var(--background)"
            strokeWidth="3"
          />
        </g>
      ) : null}

      {variant === 'footer' ? (
        <>
          <TicketSlip x={875} y={36} />
          <TicketSlip x={910} y={112} />
          <TicketSlip x={875} y={188} />
          <circle cx="860" cy="142" fill="var(--brand-green)" r="3.5" />
        </>
      ) : null}
    </svg>
  )
}
