import { config } from 'dotenv'
import populateEnv from 'populate-env'

config()

export let env = {
  PORT: 8100,
  SITE_DIR: '.',
  AUTO_CMS_AUTO_LOGIN: 'false',
  AUTO_CMS_PASSWORD: '',
  SESSION_SECRET: '',
}

populateEnv(env, { mode: 'halt' })
