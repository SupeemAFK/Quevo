type QueueBackdropProps = {
  variant: 'hero' | 'workflows' | 'footer' | 'login'
}

const route = 'M 1010 38 C 830 38 840 142 650 142 S 500 270 335 270 S 145 390 -25 390'
const footerRoute = 'M 1030 10 C 840 48 930 82 1030 116 S 875 178 1030 220'
const workflowFlow = 'M -80 650 C 150 600 170 270 415 290 S 650 650 860 480 S 1120 110 1510 190'
const workflowReturn = 'M -70 230 C 210 100 300 510 570 540 S 940 250 1100 365 S 1310 630 1510 570'
const loginFlow = 'M -80 740 C 180 670 230 340 470 350 S 770 690 940 490 S 1190 140 1520 200'
const loginReturn = 'M -60 210 C 190 100 340 470 590 500 S 900 240 1080 330 S 1300 620 1500 580'

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
      <path
        d={path}
        opacity={isFullBleed ? '0.38' : '0.52'}
        stroke="var(--brand-green)"
        strokeDasharray="2 17"
        strokeLinecap="round"
        strokeWidth="1.8"
      />

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
        <>
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
        </>
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
