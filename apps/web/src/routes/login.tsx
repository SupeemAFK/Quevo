import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { MotionConfig, motion } from 'motion/react'
import { LoginForm } from '@/components/login-form'
import { PageHeading } from '@/components/page-heading'
import { QueueBackdrop } from '@/components/queue-backdrop'
import { QuevoMark } from '@/components/quevo-mark'
import { signIn } from '@/lib/auth'
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prefersReducedMotion = usePrefersReducedMotion()

  function handleLoginSuccess() {
    queryClient.removeQueries({ queryKey: ['customer'] })
    queryClient.removeQueries({ queryKey: ['operator'] })
    void router.navigate({ to: '/' })
  }

  return (
    <MotionConfig reducedMotion="user">
      <main className="relative isolate min-h-svh overflow-hidden bg-background text-foreground">
        <QueueBackdrop variant="login" />
        <div className="relative z-10 mx-auto grid min-h-svh w-full max-w-6xl items-center gap-10 px-page py-10 sm:py-14 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16 lg:py-16">
          <section aria-labelledby="login-welcome-heading" className="mx-auto w-full max-w-xl">
            <motion.div
              className="mb-10 flex items-center gap-2.5"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.35 }}
            >
              <QuevoMark className="size-7" />
              <span className="text-lg font-semibold tracking-tight">Quevo</span>
            </motion.div>

            <motion.p
              className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.38, delay: 0.04 }}
            >
              Queue management for in-person service
            </motion.p>
            <PageHeading
              className="mt-4 max-w-[12ch] text-5xl font-semibold leading-[1.02] tracking-[-0.06em] sm:text-6xl"
              id="login-welcome-heading"
            >
              {['Your place in line.', 'Made clear.'].map((line, index) => (
                <motion.span
                  animate={{ opacity: 1, y: 0 }}
                  className="block"
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
                  key={line}
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.42,
                    delay: prefersReducedMotion ? 0 : 0.08 + index * 0.1,
                    ease: 'easeOut',
                  }}
                >
                  {line}
                </motion.span>
              ))}
            </PageHeading>
            <motion.p
              className="mt-5 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.4, delay: 0.25 }}
            >
              Keep your ticket close as a customer, or help your team move the queue forward.
            </motion.p>

            <motion.ol
              aria-label="How Quevo works"
              className="mt-9 grid max-w-lg grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 border-y py-4 sm:gap-4"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.4, delay: 0.34 }}
            >
              {[
                ['01', 'Choose'],
                ['02', 'Follow'],
                ['03', 'Get called'],
              ].map(([number, label], index) => (
                <li className="contents" key={number}>
                  {index > 0 ? (
                    <ArrowRight aria-hidden="true" className="text-muted-foreground" size={15} />
                  ) : null}
                  <span className="min-w-0">
                    <span className="block font-mono text-xs text-muted-foreground">{number}</span>
                    <span className="mt-1 block text-sm font-medium">{label}</span>
                  </span>
                </li>
              ))}
            </motion.ol>
          </section>

          <motion.section
            aria-labelledby="login-heading"
            className="mx-auto w-full max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm sm:p-8"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.48, delay: 0.12, ease: 'easeOut' }}
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Welcome back
            </p>
            <h2 className="text-3xl font-semibold tracking-tight" id="login-heading">
              Sign in
            </h2>
            <p className="mb-7 mt-2 text-sm leading-6 text-muted-foreground">
              Continue to your customer ticket or operator workspace.
            </p>
            <LoginForm
              onSuccess={handleLoginSuccess}
              signIn={async (input) => signIn({ data: input })}
            />
            <Link
              className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-foreground underline-offset-4 transition-colors hover:text-muted-foreground hover:underline focus-visible:outline"
              to="/"
            >
              <ArrowLeft aria-hidden="true" size={16} />
              Back to Quevo
            </Link>
          </motion.section>
        </div>
      </main>
    </MotionConfig>
  )
}
