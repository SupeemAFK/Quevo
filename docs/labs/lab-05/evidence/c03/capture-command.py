import os, pathlib, subprocess, sys, datetime

root = pathlib.Path('/tmp/quevo-c03-clean')
out = pathlib.Path('/tmp/quevo-c03-evidence')
out.mkdir(exist_ok=True)
env = os.environ.copy()
env.update(COMPOSE_PROJECT_NAME='quevo-c03', POSTGRES_PORT='55433')
name, *command = sys.argv[1:]
with (out / (name + '.log')).open('w') as log:
    log.write('UTC: ' + datetime.datetime.now(datetime.timezone.utc).isoformat() + '\n')
    log.write('Working directory: /tmp/quevo-c03-clean\n')
    log.write('COMPOSE_PROJECT_NAME=quevo-c03 POSTGRES_PORT=55433\n')
    log.write('$ ' + ' '.join(command) + '\n')
    log.flush()
    result = subprocess.run(command, cwd=root, env=env, stdout=log, stderr=subprocess.STDOUT)
    log.write('\nExit code: ' + str(result.returncode) + '\n')
print((out / (name + '.log')).read_text()[-6000:])
sys.exit(result.returncode)
