import express from 'express'
import { print } from 'listening-on'
import { env } from './env'
import { basename, dirname, join, resolve } from 'path'
import { autoLoginCMS, guardCMS, sessionMiddleware } from './session'
import {
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'fs'
import { detectFilenameMime } from 'mime-detect'
import { format_byte } from '@beenotung/tslib/format'
import { Formidable } from 'formidable'
import bytes from 'bytes'

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
    res.redirect('/auto-cms')
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

let parse_html_middleware = express.text({
  type: 'text/html',
  limit: env.FILE_SIZE_LIMIT,
})
let maxFileSize = bytes.parse(env.FILE_SIZE_LIMIT)
let createUploadForm = (options: { dir: string; filename: string }) =>
  new Formidable({
    uploadDir: options.dir,
    filename: () => options.filename,
    multiples: false,
    allowEmptyFiles: false,
    maxFileSize,
    filter: part => part.name == 'file',
  })
app.put(
  '/auto-cms/file',
  guardCMS,
  (req, res, next) => {
    let pathname = req.header('X-Pathname')
    if (!pathname) {
      res.status(400)
      res.json({ error: 'missing X-Pathname in header' })
      return
    }
    if (req.headers['content-type'] == 'text/html') {
      next()
      return
    }
    let dir = resolve(join(site_dir, dirname(pathname)))
    let filename = basename(pathname)
    let form = createUploadForm({ dir, filename })
    form.parse(req, (err, fields, files) => {
      if (err) {
        next(err)
        return
      }
      res.json({})
    })
  },
  parse_html_middleware,
  (req, res, next) => {
    let pathname = req.header('X-Pathname')!
    let content = req.body.trim()
    if (!content) {
      res.status(400)
      res.json({ error: 'empty content' })
      return
    }
    let file = resolveSiteFile(pathname)
    if (!file) {
      res.status(400)
      res.json({ error: 'target file not found' })
      return
    }
    writeFileSync(file, content + '\n')
    res.json({})
  },
)

app.delete('/auto-cms/file', guardCMS, (req, res, next) => {
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
  unlinkSync(file)
  res.json({})
})

app.get('/auto-cms/images', guardCMS, (req, res, next) => {
  let dir = scanImageDir(site_dir)
  res.json({ dir })
})

let cms_transparent_grid_file = resolve(
  __dirname,
  '..',
  'public',
  'transparent-grid.svg',
)
app.get('/auto-cms/transparent-grid.svg', guardCMS, (req, res, next) => {
  res.setHeader('Content-Type', 'image/svg+xml')
  res.sendFile(cms_transparent_grid_file)
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
  pathname = decodeURIComponent(pathname)
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

type Image = {
  dir: string
  filename: string
  size: string
  url: string
}

type Dir = {
  url: string
  name: string
  images: Image[]
  dirs: Dir[]
  total_image_count: number
}

function scanImageDir(dir: string): Dir {
  let result: Dir = {
    url: dir.replace(site_dir, ''),
    name: basename(dir),
    images: [],
    dirs: [],
    total_image_count: 0,
  }
  let filenames = readdirSync(dir)
  for (let filename of filenames) {
    let file = join(dir, filename)
    let stat = statSync(file)
    if (stat.isDirectory()) {
      let dir = scanImageDir(file)
      if (dir.total_image_count > 0) {
        result.total_image_count += dir.total_image_count
        result.dirs.push(dir)
      }
    } else if (stat.isFile()) {
      let mime = detectFilenameMime(filename)
      if (!mime.startsWith('image/')) continue
      let url_dir = dir.replace(site_dir, '')
      result.images.push({
        dir: url_dir,
        filename,
        size: format_byte(stat.size),
        url: join(url_dir, filename),
      })
      result.total_image_count++
    }
  }
  return result
}

app.use((req, res, next) => {
  if (req.method !== 'GET') {
    next()
    return
  }
  let filename = basename(req.path)
  if (filename == '.env') {
    next()
    return
  }
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
