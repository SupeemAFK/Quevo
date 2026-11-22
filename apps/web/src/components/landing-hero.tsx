import { Link } from '@tanstack/react-router'
import { ArrowRight, Check, ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import type { Identity } from '@/lib/auth'
import { PageHeading } from './page-heading'
import { Button } from './ui/button'

type LandingHeroProps = {
  user: Identity | null
}

export function LandingHero({ user }: LandingHeroProps) {
  const appPath = user?.role === 'CUSTOMER' ? '/customer' : '/operator'

  return (
    <section
      aria-labelledby="hero-heading"
      className="landing-hero relative isolate overflow-hidden"
      id="top"
      tabIndex={-1}
    >
      <div aria-hidden="true" className="landing-hero-grid" />
      <div className="landing-hero-glow landing-hero-glow-one" aria-hidden="true" />
      <div className="landing-hero-glow landing-hero-glow-two" aria-hidden="true" />

      <div className="relative mx-auto grid max-w-content gap-14 px-page pb-20 pt-14 sm:pb-24 sm:pt-20 lg:min-h-[650px] lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10 lg:py-20">
        <div className="relative z-10 max-w-2xl">
          <motion.p
            animate={{ opacity: 1, y: 0 }}
            className="landing-eyebrow inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/80 px-3.5 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur"
            initial={{ opacity: 0, y: 12 }}
            transition={{ delay: 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <span aria-hidden="true" className="landing-eyebrow-mark">
              <span />
            </span>
            A calmer way to move through the line
          </motion.p>

          <motion.div
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.16, duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
          >
            <PageHeading
              className="mt-6 max-w-[15ch] text-display font-semibold leading-[0.98] tracking-[-0.06em]"
              id="hero-heading"
            >
              A lighter wait.
              <span className="block text-primary">A clearer next step.</span>
            </PageHeading>
          </motion.div>

          <motion.p
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground sm:text-xl sm:leading-8"
            initial={{ opacity: 0, y: 18 }}
            transition={{ delay: 0.24, duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
          >
            Join an active service, keep your ticket close, and see its status. Operators get a
            focused view of each queue from the first call through completion.
          </motion.p>

          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 flex flex-wrap gap-3"
            initial={{ opacity: 0, y: 16 }}
            transition={{ delay: 0.3, duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
          >
            <Button asChild className="landing-primary-action min-h-12 px-5 text-base">
              <Link to={user ? appPath : '/login'}>
                {user ? 'Open your queue' : 'Sign in to Quevo'}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              className="min-h-12 border-primary/20 bg-background/80 px-5 text-base backdrop-blur"
              variant="outline"
            >
              <a href="#queue-demo">
                Try the queue demo
                <ChevronRight aria-hidden="true" />
              </a>
            </Button>
          </motion.div>

          <motion.div
            animate={{ opacity: 1 }}
            className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-muted-foreground"
            initial={{ opacity: 0 }}
            transition={{ delay: 0.48, duration: 0.55 }}
          >
            <span className="inline-flex items-center gap-2">
              <Check aria-hidden="true" className="text-status-success" size={16} />
              One clear ticket journey
            </span>
            <span className="hidden h-4 w-px bg-border sm:block" />
            <span className="inline-flex items-center gap-2">
              <Check aria-hidden="true" className="text-status-success" size={16} />A view for each
              role
            </span>
          </motion.div>
        </div>

        <motion.aside
          aria-label="Sample queue preview"
          className="landing-preview-wrap relative mx-auto w-full max-w-[590px]"
          initial={{ opacity: 0, y: 26, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ y: -4, rotate: -0.25 }}
        >
          <div
            aria-hidden="true"
            className="landing-preview-decoration landing-preview-decoration-one"
          />
          <div
            aria-hidden="true"
            className="landing-preview-decoration landing-preview-decoration-two"
          />

          <div className="landing-preview-window relative">
            <div className="flex items-center justify-between gap-3 border-b border-border/80 px-5 py-4 sm:px-7">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="landing-window-mark">
                  Q
                </span>
                <div>
                  <p className="text-sm font-semibold tracking-tight">Queue overview</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">General service</p>
                </div>
              </div>
              <span className="landing-sample-pill">Sample queue</span>
            </div>

            <div className="grid gap-4 p-4 sm:gap-5 sm:p-6">
              <div className="landing-ticket-feature rounded-2xl p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Your ticket</p>
                    <p className="mt-2 text-5xl font-semibold leading-none tracking-[-0.06em] tabular-nums sm:text-6xl">
                      A104
                    </p>
                  </div>
                  <span className="landing-waiting-pill">
                    <span aria-hidden="true" />
                    Waiting
                  </span>
                </div>
                <div aria-hidden="true" className="landing-queue-track mt-6">
                  <span className="landing-queue-track-progress" />
                  <span className="landing-queue-track-dot landing-queue-track-dot-one" />
                  <span className="landing-queue-track-dot landing-queue-track-dot-two" />
                  <span className="landing-queue-track-dot landing-queue-track-dot-three" />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Two sample tickets are ahead in line.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="landing-preview-stat rounded-xl border border-border/80 bg-background p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.11em] text-muted-foreground">
                    Now serving
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-2xl font-semibold tracking-tight tabular-nums">A101</span>
                    <span className="grid size-8 place-items-center rounded-full bg-status-success-surface text-status-success">
                      <Check aria-hidden="true" size={16} />
                    </span>
                  </div>
                </div>
                <div className="landing-preview-stat rounded-xl border border-border/80 bg-background p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.11em] text-muted-foreground">
                    Ahead of you
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-2xl font-semibold tracking-tight tabular-nums">02</span>
                    <span className="flex -space-x-2" aria-hidden="true">
                      <span className="landing-ticket-chip landing-ticket-chip-blue">A2</span>
                      <span className="landing-ticket-chip landing-ticket-chip-green">A3</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl bg-muted/75 px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-background text-primary shadow-sm">
                  <Check aria-hidden="true" size={17} />
                </span>
                <p className="text-sm leading-5 text-muted-foreground">
                  Ticket status stays clear at every step.
                </p>
              </div>
            </div>
          </div>

          <motion.div
            aria-hidden="true"
            className="landing-callout-bubble absolute -left-4 top-[27%] hidden items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-xl shadow-primary/10 sm:flex"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <span className="landing-callout-icon grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <ArrowRight size={17} />
            </span>
            <span>
              <span className="block text-xs font-medium text-muted-foreground">Sample call</span>
              <span className="mt-0.5 block text-sm font-semibold">A101 · now serving</span>
            </span>
          </motion.div>
        </motion.aside>
      </div>

      <div aria-hidden="true" className="landing-hero-baseline" />
    </section>
  )
}
