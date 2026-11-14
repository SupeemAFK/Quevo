import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PostgreSqlContainer } from '@testcontainers/postgresql'

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const apiRoot = resolve(repoRoot, 'apps/api')
const webRoot = resolve(repoRoot, 'apps/web')
const processErrors = new WeakMap<ChildProcess, Error>()

export default async function globalSetup() {
  const tempDirectory = await mkdtemp(join(tmpdir(), 'quevo-e2e-'))
  const apiBinary = join(tempDirectory, 'quevo-api')
  let stopPostgres: (() => Promise<void>) | undefined
  let databaseURL = ''
  let api: ChildProcess | undefined
  let web: ChildProcess | undefined

  const cleanup = async () => {
    await stopProcess(web)
    await stopProcess(api)
    await stopPostgres?.()
    await rm(tempDirectory, { recursive: true, force: true })
  }

  try {
    const postgres = await new PostgreSqlContainer('postgres:17-alpine')
      .withDatabase('quevo_e2e')
      .withUsername('quevo')
      .withPassword('quevo-test')
      .start()
    stopPostgres = () => postgres.stop()
    databaseURL = postgres.getConnectionUri()

    const apiEnv = {
      ...process.env,
      PORT: '8080',
      DATABASE_URL: databaseURL,
    }

    execFileSync('go', ['run', './cmd/migrate'], {
      cwd: apiRoot,
      env: apiEnv,
      stdio: 'inherit',
    })
    const seedOutput = execFileSync('go', ['run', './cmd/seed', '-allow-piped-output'], {
      cwd: apiRoot,
      env: apiEnv,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    })
    const credentials = JSON.parse(seedOutput)
    const customerPassword = credentials['customer@quevo.local']
    const operatorPassword = credentials['operator@quevo.local']
    if (typeof customerPassword !== 'string' || typeof operatorPassword !== 'string') {
      throw new Error('Seed did not create both demo accounts')
    }

    execFileSync('go', ['build', '-o', apiBinary, './cmd/server'], {
      cwd: apiRoot,
      stdio: 'inherit',
    })

    api = startProcess(apiBinary, [], apiEnv, apiRoot)
    await waitFor('http://127.0.0.1:8080/api/v1/health', api, 'Go API')

    web = startProcess(
      'bun',
      ['--bun', 'x', 'vite', 'dev', '--port', '3000', '--host', '0.0.0.0'],
      {
        ...process.env,
        API_BASE_URL: 'http://127.0.0.1:8080',
      },
      webRoot,
    )
    await waitFor('http://127.0.0.1:3000', web, 'web app')
    process.env.QUEVO_E2E_CUSTOMER_PASSWORD = customerPassword
    process.env.QUEVO_E2E_OPERATOR_PASSWORD = operatorPassword
  } catch (error) {
    await cleanup()
    throw error
  }

  return cleanup
}

function startProcess(command: string, args: string[], env: NodeJS.ProcessEnv, cwd: string) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
  })
  child.on('error', (error) => {
    processErrors.set(child, error)
    console.error(`Could not start ${command}:`, error)
  })
  return child
}

async function waitFor(url: string, child: ChildProcess, name: string) {
  const deadline = Date.now() + 120_000

  while (Date.now() < deadline) {
    const spawnError = processErrors.get(child)
    if (spawnError) throw new Error(`${name} failed to start`, { cause: spawnError })
    if (child.exitCode !== null) {
      throw new Error(`${name} exited with code ${child.exitCode} before becoming ready`)
    }

    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Keep waiting while the process starts.
    }

    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  throw new Error(`${name} did not become ready at ${url}`)
}

async function stopProcess(child?: ChildProcess) {
  if (!child || child.exitCode !== null || child.signalCode !== null || !child.pid) return

  const signal = process.platform === 'win32' ? child.kill.bind(child) : (name: NodeJS.Signals) => {
    try {
      process.kill(-child.pid!, name)
      return true
    } catch {
      return false
    }
  }

  signal('SIGTERM')
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 5_000)
    child.once('exit', () => {
      clearTimeout(timeout)
      resolve()
    })
  })

  if (child.exitCode === null && child.signalCode === null) signal('SIGKILL')
}
