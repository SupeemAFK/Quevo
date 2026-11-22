import { Link } from '@tanstack/react-router'
import { ArrowDown, ArrowRight, ArrowUpRight } from 'lucide-react'
import { motion } from 'motion/react'
import { LandingReveal } from './landing-reveal'
import { Button } from './ui/button'

const lifecycle = [
  { label: 'Join', description: 'Choose an active service and receive a ticket.' },
  { label: 'Wait', description: 'Your ticket stays in line until an operator calls it.' },
  { label: 'Called', description: 'The operator brings the next waiting ticket forward.' },
  { label: 'In service', description: 'The operator starts serving the current ticket.' },
  { label: 'Complete or skip', description: 'The operator records the result of the visit.' },
]

export function LandingWorkflows() {
  return (
    <section
      aria-labelledby="workflows-heading"
      className="scroll-mt-24 mx-auto max-w-content px-page py-section"
      id="workflows"
      tabIndex={-1}
    >
      <LandingReveal className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
          One visit, two clear views
        </p>
        <h2 className="mt-3 text-section font-semibold tracking-tight" id="workflows-heading">
          Simple steps for customers and operators.
        </h2>
        <p className="mt-4 leading-7 text-muted-foreground">
          Quevo follows the ticket from joining the line through service, with the right actions for
          each role.
        </p>
      </LandingReveal>

      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <motion.article
          className="landing-feature-card rounded-2xl border bg-card p-6 sm:p-8"
          initial={{ opacity: 0, y: 22 }}
          transition={{ delay: 0.06, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ amount: 0.24, once: true }}
          whileInView={{ opacity: 1, y: 0 }}
          whileHover={{ y: -5 }}
        >
          <span aria-hidden="true" className="landing-feature-icon landing-feature-icon-customer">
            01
          </span>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            For customers
          </p>
          <h3 className="mt-3 text-xl font-semibold tracking-tight">
            Get a ticket for your visit.
          </h3>
          <ol className="mt-6 space-y-4">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                1
              </span>
              <span className="leading-6">Sign in and choose an active branch service.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                2
              </span>
              <span className="leading-6">Join the queue and receive your ticket number.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                3
              </span>
              <span className="leading-6">Return to your ticket to see its current status.</span>
            </li>
          </ol>
          <Button asChild className="mt-7 min-h-11 px-4" variant="outline">
            <Link to="/login">
              Customer sign in
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
        </motion.article>

        <motion.article
          className="landing-feature-card rounded-2xl border bg-card p-6 sm:p-8"
          initial={{ opacity: 0, y: 22 }}
          transition={{ delay: 0.16, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ amount: 0.24, once: true }}
          whileInView={{ opacity: 1, y: 0 }}
          whileHover={{ y: -5 }}
        >
          <span aria-hidden="true" className="landing-feature-icon landing-feature-icon-operator">
            02
          </span>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            For operators
          </p>
          <h3 className="mt-3 text-xl font-semibold tracking-tight">
            Keep the assigned queue moving.
          </h3>
          <ol className="mt-6 space-y-4">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                1
              </span>
              <span className="leading-6">Open an assigned branch and service queue.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                2
              </span>
              <span className="leading-6">Call the next waiting ticket and start service.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                3
              </span>
              <span className="leading-6">Complete or skip the current ticket.</span>
            </li>
          </ol>
          <Button asChild className="mt-7 min-h-11 px-4" variant="outline">
            <Link to="/login">
              Operator sign in
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
        </motion.article>
      </div>

      <LandingReveal delay={0.12}>
        <section
          aria-labelledby="lifecycle-heading"
          className="landing-lifecycle mt-14 rounded-2xl bg-muted p-6 sm:p-8"
        >
          <div className="max-w-2xl">
            <h3 className="text-lg font-semibold" id="lifecycle-heading">
              The ticket lifecycle
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Each step has a clear status, from the first place in line through the operator’s
              final action.
            </p>
          </div>
          <ol
            aria-label="Queue ticket lifecycle"
            className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
          >
            {lifecycle.map((step, index) => (
              <motion.li
                className="landing-lifecycle-step flex items-start gap-3 rounded-xl border bg-card p-4"
                key={step.label}
                initial={{ opacity: 0, y: 12 }}
                transition={{ delay: index * 0.07, duration: 0.4, ease: 'easeOut' }}
                viewport={{ amount: 0.3, once: true }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ y: -3 }}
              >
                <span
                  aria-hidden="true"
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground"
                >
                  {index === lifecycle.length - 1 ? (
                    <ArrowRight size={16} />
                  ) : index > 0 ? (
                    <ArrowDown className="sm:hidden" size={16} />
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                  {index > 0 && index < lifecycle.length - 1 ? (
                    <ArrowRight className="hidden sm:block" size={16} />
                  ) : null}
                </span>
                <span>
                  <span className="block font-semibold">{step.label}</span>
                  <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                    {step.description}
                  </span>
                </span>
              </motion.li>
            ))}
          </ol>
        </section>
      </LandingReveal>
    </section>
  )
}
