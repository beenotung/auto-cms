import { RequestHandler } from 'express'
import expressSession from 'express-session'
import { env } from './env'

export let sessionMiddleware = expressSession({
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
})

declare module 'express-session' {
  interface SessionData {
    auto_cms_enabled: boolean
  }
}

export let autoLoginCMS: RequestHandler = (req, res, next) => {
  if (env.AUTO_CMS_AUTO_LOGIN == 'true') {
    req.session.auto_cms_enabled = true
  }
  next()
}

export let guardCMS: RequestHandler = (req, res, next) => {
  if (req.session.auto_cms_enabled) {
    next()
  } else {
    res.status(401)
    res.json({ error: 'auto cms not enabled' })
  }
}
