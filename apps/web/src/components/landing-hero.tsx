import { Link } from '@tanstack/react-router'
import { ArrowDown, ArrowRight, ListOrdered } from 'lucide-react'
import { MotionConfig, motion } from 'motion/react'
import type { Identity } from '@/lib/auth'
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion'
import { PageHeading } from './page-heading'
import { QueueDemo } from './queue-demo'
import { Button } from './ui/button'

type LandingHeroProps = {
  user: Identity | null
}

function FlowBackdrop({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute right-0 top-0 hidden h-full w-[68%] lg:block"
      fill="none"
      preserveAspectRatio="none"
      viewBox="0 0 900 650"
    >
      <path
        d="M 930 90 C 770 90 790 205 635 205 S 500 365 350 365 S 180 545 -40 545"
        opacity="0.32"
        stroke="var(--border)"
        strokeWidth="1.5"
      />
      <motion.path
        animate={reducedMotion ? { strokeDashoffset: 0 } : { strokeDashoffset: [0, -120] }}
        d="M 930 90 C 770 90 790 205 635 205 S 500 365 350 365 S 180 545 -40 545"
        opacity="0.38"
        stroke="var(--brand-green)"
        strokeDasharray="2 18"
        strokeLinecap="round"
        strokeWidth="2"
        transition={{ duration: 18, ease: 'linear', repeat: reducedMotion ? 0 : Infinity }}
      />
      <motion.circle
        animate={
          reducedMotion
            ? { cx: 635, cy: 205 }
            : {
                cx: [930, 850, 780, 690, 635, 550, 480, 350, 280, 220, 150, 50, -40],
                cy: [90, 101, 150, 199, 205, 245, 320, 365, 415, 500, 545, 545, 545],
              }
        }
        fill="var(--brand-green)"
        r="4"
        stroke="var(--background)"
        strokeWidth="3"
        transition={{ duration: 20, ease: 'linear', repeat: reducedMotion ? 0 : Infinity }}
      />
      <circle cx="635" cy="205" fill="var(--background)" r="5" stroke="var(--border)" />
      <circle cx="350" cy="365" fill="var(--background)" r="5" stroke="var(--border)" />
    </svg>
  )
}

function reveal(delay: number, reducedMotion: boolean) {
  return {
    initial: reducedMotion ? false : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: reducedMotion ? 0 : 0.48,
      delay: reducedMotion ? 0 : delay,
      ease: 'easeOut' as const,
    },
  }
}

export function LandingHero({ user }: LandingHeroProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const appPath = user?.role === 'CUSTOMER' ? '/customer' : '/operator'

  return (
    <MotionConfig reducedMotion="user">
      <section
        aria-labelledby="hero-heading"
        className="relative isolate border-b bg-background"
        id="top"
        tabIndex={-1}
      >
        <FlowBackdrop reducedMotion={prefersReducedMotion} />
        <div className="relative z-10 mx-auto grid max-w-content items-center gap-10 px-page py-14 sm:py-18 lg:min-h-[650px] lg:grid-cols-[0.78fr_1.22fr] lg:gap-12 lg:py-20">
          <div className="max-w-xl">
            <motion.p
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground"
              {...reveal(0, prefersReducedMotion)}
            >
              <ListOrdered aria-hidden="true" className="text-brand-green" size={16} />
              Queue management for in-person service
            </motion.p>
            <PageHeading
              aria-label="Your place in line. Made clear."
              className="mt-6 max-w-[11ch] text-display font-semibold leading-[0.98] tracking-[-0.065em]"
              id="hero-heading"
            >
              {['Your place', 'in line.', 'Made clear.'].map((line, index) => (
                <motion.span
                  animate={{ opacity: 1, y: 0 }}
                  aria-hidden="true"
                  className="block"
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
                  key={line}
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.45,
                    delay: prefersReducedMotion ? 0 : 0.07 + index * 0.09,
                    ease: 'easeOut',
                  }}
                >
                  {line}
                </motion.span>
              ))}
            </PageHeading>
            <motion.p
              className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground"
              {...reveal(0.14, prefersReducedMotion)}
            >
              Choose a walk-in service on your phone, keep your ticket handy, and check your status
              while staff work through the line.
            </motion.p>
            <motion.div
              className="mt-8 flex flex-wrap items-center gap-3"
              {...reveal(0.21, prefersReducedMotion)}
            >
              <Button asChild className="min-h-12 px-5 text-base">
                <Link to={user ? appPath : '/login'}>
                  {user ? 'Open your queue' : 'Sign in to Quevo'}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild className="min-h-12 border-border px-5 text-base" variant="outline">
                <a href="#queue-demo">
                  Explore the sample
                  <ArrowDown aria-hidden="true" />
                </a>
              </Button>
            </motion.div>
            <motion.ol
              aria-label="Choose a service, follow your ticket, and get called"
              className="mt-10 grid max-w-md list-none grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 border-y py-4 text-xs sm:gap-3"
              {...reveal(0.28, prefersReducedMotion)}
            >
              <li>
                <span className="font-mono text-muted-foreground">01</span>
                <p className="mt-1 font-medium">Choose</p>
              </li>
              <li aria-hidden="true">
                <ArrowRight className="text-muted-foreground" size={15} />
              </li>
              <li>
                <span className="font-mono text-muted-foreground">02</span>
                <p className="mt-1 font-medium">Follow</p>
              </li>
              <li aria-hidden="true">
                <ArrowRight className="text-muted-foreground" size={15} />
              </li>
              <li>
                <span className="font-mono text-muted-foreground">03</span>
                <p className="mt-1 font-medium">Get called</p>
              </li>
            </motion.ol>
          </div>

          <motion.div className="relative min-w-0 lg:pl-2" {...reveal(0.2, prefersReducedMotion)}>
            <div
              aria-hidden="true"
              className="absolute inset-x-0 -bottom-3 top-3 rounded-xl border bg-muted transition-transform duration-300 ease-out motion-reduce:transform-none lg:-inset-x-3 lg:-rotate-1 lg:hover:rotate-0"
            />
            <div className="relative">
              <QueueDemo />
            </div>
          </motion.div>
        </div>
      </section>
    </MotionConfig>
  )
}
