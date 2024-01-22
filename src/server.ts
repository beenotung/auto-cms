import express from 'express'
import { print } from 'listening-on'
import { env } from './env'
import { join, resolve } from 'path'
import { autoLoginCMS, guardCMS, sessionMiddleware } from './session'
import { readFileSync, statSync, writeFileSync } from 'fs'

console.log('Project Directory:', env.SITE_DIR)

let app = express()

app.use(sessionMiddleware)
app.use(autoLoginCMS)

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
app.post('/auto-cms/save', guardCMS, express.text(), (req, res, next) => {
  let pathname = req.header('X-Pathname')
  if (!pathname) {
    res.status(400)
    res.json({ error: 'missing X-Pathname in header' })
    return
  }
  let file = resolveSiteFile(pathname)
  if (!file) {
    res.status(400)
    res.json({ error: 'target file not found' })
    return
  }
  let content = req.body.trim()
  if (!content) {
    res.status(400)
    res.json({ error: 'empty content' })
    return
  }
  writeFileSync(file, content + '\n')
  res.json({})
})
let cms_js_file = resolve(__dirname, '..', 'public', 'auto-cms.js')
app.get('/auto-cms.js', guardCMS, (req, res, next) => {
  res.setHeader('Content-Type', 'application/javascript')
  res.sendFile(cms_js_file)
})
let cms_index_file = resolve(__dirname, '..', 'public', 'auto-cms.html')
app.get('/auto-cms', (req, res, next) => {
  res.sendFile(cms_index_file)
})

let site_dir = resolve(env.SITE_DIR)

function resolveSiteFile(pathname: string) {
  try {
    let file = resolve(join(site_dir, pathname))
    if (!file.startsWith(site_dir)) return null
    let stat = statSync(file)
    if (stat.isDirectory()) {
      file = join(file, 'index.html')
      stat = statSync(file)
    }
    if (!stat.isFile()) return null
    return file
  } catch (error) {
    let message = String(error)
    if (message.includes('ENOENT')) return null
    throw error
  }
}

app.use((req, res, next) => {
  try {
    let file = resolveSiteFile(req.path)
    if (!file) return next()
    if (req.session.auto_cms_enabled && file.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html')
      res.write(readFileSync(file))
      res.write('<script src="/auto-cms.js"></script>')
      res.end()
    } else {
      res.sendFile(file)
    }
  } catch (error) {
    next(error)
  }
})

let port = env.PORT
app.listen(port, () => {
  print(port)
})
