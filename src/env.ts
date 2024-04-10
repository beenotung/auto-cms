import { randomUUID } from 'crypto'
import { config } from 'dotenv'
import { existsSync, writeFileSync } from 'fs'
import populateEnv from 'populate-env'

config()

export let env = {
  PORT: 8100,
  SITE_DIR: '.',
  AUTO_CMS_AUTO_LOGIN: 'false',
  AUTO_CMS_PASSWORD: '',
  SESSION_SECRET: '',
  FILE_SIZE_LIMIT: '10MB',
}

try {
  populateEnv(env, { mode: 'error' })
} catch (error) {
  console.error(String(error))
  let file = '.env'
  if (!existsSync(file)) {
    if (!process.argv.slice(2).includes('--setup')) {
      console.error(
        'Hint: You can run this cli again with "--setup" to auto setup the ".env" file',
      )
      process.exit(1)
    }
  }
  console.error('Hint: auto setting the ".env" file')
  let secret = randomUUID()
  env.AUTO_CMS_PASSWORD = secret
  env.SESSION_SECRET = secret
  let text = ''
  for (let [key, value] of Object.entries(env)) {
    text += `${key}=${value}\n`
  }
  writeFileSync(file, text)
}
