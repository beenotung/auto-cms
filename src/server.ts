import express from 'express'
import { print } from 'listening-on'
import { env } from './env'
import { join, resolve } from 'path'
import { sessionMiddleware } from './session'
import { existsSync, statSync } from 'fs'

console.log('Project Directory:', env.SITE_DIR)

let app = express()

app.use(sessionMiddleware)

app.use('/auto-cms', express.static(join(__dirname, '..', 'public')))
app.get('/auto-cms/status', (req, res, next) => {
  res.json({ enabled: req.session.auto_cms_enabled || false })
})
app.post(
  '/auto-cms/login',
  express.urlencoded({ extended: false }),
  (req, res, next) => {
    if (req.body.password != env.AUTO_CMS_PASSWORD) {
      res.status(403)
      res.end('wrong password')
      return
    }
    req.session.auto_cms_enabled = true
    req.session.save()
    res.redirect('/')
  },
)
app.post(
  '/auto-cms/logout',
  express.urlencoded({ extended: false }),
  (req, res, next) => {
    req.session.auto_cms_enabled = false
    req.session.save()
    res.redirect('/')
  },
)

let site_dir = resolve(env.SITE_DIR)
app.use((req, res, next) => {
  let file = resolve(join(site_dir, req.path))
  if (!file.startsWith(site_dir)) {
    next()
    return
  }
  try {
    let stat = statSync(file)
    if (stat.isDirectory()) {
      file = join(file, 'index.html')
      stat = statSync(file)
    }
    if (stat.isFile()) {
      res.sendFile(file)
      return
    }
  } catch (error) {
    next(error)
  }
  next()
})

let port = env.PORT
app.listen(port, () => {
  print(port)
})
