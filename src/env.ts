import { randomUUID } from 'crypto'
import { config as loadEnv } from 'dotenv'
import { existsSync } from 'fs'
import { resolve } from 'path'
import populateEnv, { saveEnv, toBoolean } from 'populate-env'

loadEnv()

export let env = {
  NODE_ENV: 'development',
  PORT: 8100,
  SITE_DIR: '',
  AUTO_CMS_AUTO_LOGIN: 'false',
  AUTO_CMS_AUTO_BACKUP: 'true',
  AUTO_CMS_PASSWORD: '',
  AUTO_CMS_TEMPLATE: 'true',
  AUTO_CMS_MULTI_LANG: 'true',
  AUTO_CMS_ENABLE_EASYNMT: 'false',
  AUTO_CMS_DEFAULT_LANG: 'en' as const,
  SUBMIT_CONTACT_RESULT_PAGE: 'default' as const,
  SESSION_SECRET: '',
  FILE_SIZE_LIMIT: '10MB',

  /* for email */
  TIMEZONE_HOUR: +8,
  EMAIL_SERVICE: 'google',
  EMAIL_HOST: 'smtp.gmail.com',
  EMAIL_PORT: 587,
  EMAIL_USER: '',
  EMAIL_PASSWORD: '',
  ORIGIN: '',
}
applyDefaultEnv()

function applyDefaultEnv() {
  if (process.env.NODE_ENV === 'production') return
  let PORT = process.env.PORT || env.PORT
  env.EMAIL_USER ||= process.env.EMAIL_USER || 'skip'
  env.EMAIL_PASSWORD ||= process.env.EMAIL_PASSWORD || 'skip'
  env.ORIGIN ||= process.env.ORIGIN || 'http://localhost:' + PORT
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
  saveEnv({ env })
}

if (resolve(env.SITE_DIR) == resolve(process.cwd())) {
  console.error(
    'SITE_DIR is same as current directory, this setup may expose private files. Please put your public files in a folder and update the SITE_DIR accordingly.',
  )
  process.exit(1)
}

export let config = {
  enabled_auto_login: toBoolean(env.AUTO_CMS_AUTO_LOGIN),
  enabled_auto_backup: toBoolean(env.AUTO_CMS_AUTO_BACKUP),
  enabled_template: toBoolean(env.AUTO_CMS_TEMPLATE),
  enabled_multi_lang: toBoolean(env.AUTO_CMS_MULTI_LANG),
  enabled_easynmt: toBoolean(env.AUTO_CMS_ENABLE_EASYNMT),
}
