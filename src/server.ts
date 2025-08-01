import express, { Request, Response } from 'express'
import { print } from 'listening-on'
import { config, env } from './env'
import { TimezoneDate } from 'timezone-date.ts'
import { basename, dirname, extname, join, resolve } from 'path'
import { autoLoginCMS, guardCMS, sessionMiddleware } from './session'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'fs'
import { detectFilenameMime } from 'mime-detect'
import { format_2_digit, format_byte } from '@beenotung/tslib/format'
import { Formidable } from 'formidable'
import bytes from 'bytes'
import { setupConfigFile } from './config-file'
import {
  LangDict,
  LangFileSuffix,
  extractWrappedText,
  loadLangFile,
  setupEasyNMT,
  translateHTML,
  langDictParser,
  Lang,
  en_to_zh,
  to_hk,
  detectLang,
  to_en,
  en_to_ar,
  en_to_ja,
  en_to_ko,
  Langs,
} from './i18n'
import { decodeHTML } from './html'
import { setupKnex } from './knex'
import { pkg } from './pkg'
import { storeContact, storeRequest } from './store'
import { applyTemplates } from './template'
import { resolvePathname } from './file'
import { cookieMiddleware } from './cookie'
import { sendEmail } from './email'
import { capitalize } from '@beenotung/tslib'
import { Contact } from './proxy'

setupKnex()

if (config.enabled_multi_lang && config.enabled_easynmt) {
  setupEasyNMT()
}

console.log(pkg.name, 'v' + pkg.version)
console.log('Project Directory:', env.SITE_DIR)

setupConfigFile()

let app = express()

// app.disable('x-powered-by')
// app.use((req, res, next) => {
//   res.setHeader('X-Powered-By', 'auto-cms with Express')
//   next()
// })

app.use(sessionMiddleware)
app.use(cookieMiddleware)

if (config.enabled_auto_login) {
  app.use(autoLoginCMS)
}

app.use((req, res, next) => {
  storeRequest(req)
  next()
})

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

// list site files
app.use((req, res, next) => {
  if (
    !req.session.auto_cms_enabled ||
    req.method != 'GET' ||
    !req.path.endsWith('__list__')
  ) {
    return next()
  }

  let file_path = resolvePathname({ site_dir, pathname: dirname(req.path) })
  if ('error' in file_path) {
    res.status(500)
    next(file_path.error)
    return
  }

  let dir = dirname(file_path.file)

  let dir_pathname = dir.replace(site_dir, '')
  if (dir_pathname == '') {
    dir_pathname = '/'
  }

  let title = escapeHTML(`File List of ${dir_pathname}`)

  res.write(/* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    .highlight {
      /* font-weight: bold; */
      background-color: yellow;
    }
    body {
      font-family: monospace;
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
`)

  if (dir_pathname != '/') {
    let parent_pathname = dirname(dir_pathname)
    let parent_href = parent_pathname
    if (!parent_href.endsWith('/')) {
      parent_href += '/'
    }
    parent_href += '__list__'
    res.write(/* html */ `
  <nav><a href="${parent_href}">Back to ${parent_pathname}</a></nav>
`)
  }

  res.write(/* html */ `
  <ol>`)

  let filenames = readdirSync(dir)
  let base_filename = basename(file_path.file).replaceAll(/_bk[0-9T]{15}/g, '')
  for (let filename of filenames) {
    let href = join(dir.replace(site_dir, '/'), filename)
      .replaceAll('//', '/')
      .replaceAll('//', '/')
    let file = join(dir, filename)
    let stat = statSync(file)
    let type = '[F]'
    if (stat.isDirectory()) {
      type = '[D]'
      if (!href.endsWith('/')) {
        href += '/'
      }
      href += '__list__'
    }
    let className =
      filename.replaceAll(/_bk[0-9T]{15}/g, '') == base_filename
        ? 'highlight'
        : ''
    let filename_html = escapeHTML(filename)
    res.write(/* html */ `
    <li>${type} <a href="${href}" class="${className}">${filename_html}</a></li>`)
  }

  res.end(/* html */ `
  </ol>
</body>
</html>
`)
})

// resolve implicit index.html or .html suffix
app.options('/auto-cms/file', guardCMS, (req, res, next) => {
  let pathname = req.header('X-Pathname')
  if (!pathname) {
    res.status(400)
    res.json({ error: 'missing X-Pathname in header' })
    return
  }
  let path = resolvePathname({ site_dir, pathname, mkdir: true })
  if ('error' in path) {
    res.status(500)
    res.json({ error: path.error })
    return
  }
  pathname = path.file.replace(site_dir, '')
  if (pathname == '') {
    pathname = '/'
  }
  res.json({ pathname, exists: path.exists })
})

// save file (update html page, or upload image)
let parse_html_middleware = express.text({
  type: ['text/html', 'text/html; charset=utf-8'],
  limit: env.FILE_SIZE_LIMIT,
  defaultCharset: 'utf-8',
})
let maxFileSize = bytes.parse(env.FILE_SIZE_LIMIT)!
let createUploadForm = (options: { dir: string; filename: string }) =>
  new Formidable({
    uploadDir: options.dir,
    filename: () => options.filename,
    multiples: false,
    allowEmptyFiles: false,
    maxFileSize,
    filter: part => part.name == 'file',
  })
type PutRequest = Request & { vars: { file: string } }
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

    // upload text/html
    if (
      req.header('Content-Type')?.includes('text/html') ||
      req.header('Content-Type')?.includes('application/json')
    ) {
      let path = resolvePathname({ site_dir, pathname, mkdir: true })
      if ('error' in path) {
        res.status(500)
        res.json({ error: path.error })
        return
      }
      if (!path.exists) {
        res.status(400)
        res.json({ error: 'target file not found' })
        return
      }
      ;(req as PutRequest).vars = path
      next()
      return
    }

    // upload multipart form data
    let file = resolve(join(site_dir, decodeURIComponent(pathname)))
    if (!file.startsWith(site_dir)) {
      res.status(400)
      res.json({ error: 'resolved pathname is out of the site directory' })
      return
    }
    if (
      existsSync(file) &&
      statSync(file).isDirectory() &&
      readdirSync(file).length == 0
    ) {
      rmdirSync(file)
    }
    let dir = dirname(file)
    let filename = basename(file)
    mkdirSync(dir, { recursive: true })
    let form = createUploadForm({ dir, filename })
    form.parse(req, (err, fields, files) => {
      if (err) {
        res.status(500)
        res.json({ error: String(err) })
        return
      }
      res.json({})
    })
  },
  parse_html_middleware,
  express.json(),
  (req, res, next) => {
    let file = (req as PutRequest).vars.file
    if (file.endsWith('.json')) {
      saveLangDict({ file, json: req.body })
      res.json({ message: 'saved to target file' })
      return
    }
    let content = req.body.trim() as string
    if (!content) {
      res.status(400)
      res.json({ error: 'empty content' })
      return
    }
    saveHTMLFile(file, content + '\n')
    res.json({ message: 'saved to target file' })
  },
)

// copy file (restore html from backup version, or save as new page)
app.put('/auto-cms/file/copy', guardCMS, (req, res, next) => {
  let from_pathname = req.header('X-From-Pathname')
  if (!from_pathname) {
    res.status(400)
    res.json({ error: 'missing X-From-Pathname in header' })
    return
  }

  let to_pathname = req.header('X-To-Pathname')
  if (!to_pathname) {
    res.status(400)
    res.json({ error: 'missing X-To-Pathname in header' })
    return
  }

  let from_path = resolvePathname({
    site_dir,
    pathname: from_pathname,
  })
  if ('error' in from_path) {
    res.status(500)
    res.json({ error: from_path.error })
    return
  }
  if (!from_path.exists) {
    res.status(400)
    res.json({ error: 'resolved from path does not exist' })
    return
  }

  let to_path = resolvePathname({
    site_dir,
    pathname: to_pathname,
    mkdir: true,
  })
  if ('error' in to_path) {
    res.status(500)
    res.json({ error: to_path.error })
    return
  }

  if (config.enabled_auto_backup && to_path.exists) {
    saveBackup(to_path.file)
  }

  copyFileSync(from_path.file, to_path.file)

  res.json({ message: 'saved to target file' })
})

function saveHTMLFile(file: string, content: string) {
  if (config.enabled_auto_backup) {
    saveBackup(file)
  }
  writeFileSync(file, content)
  saveLangFile(file + LangFileSuffix, content)
}

function saveLangFile(file: string, content: string) {
  let dict: LangDict = loadLangFile(file) || {}

  if (config.enabled_auto_backup) {
    saveBackup(file)
  }

  let matches = extractWrappedText(content)
  for (let match of matches) {
    let key = match
    let word = dict[key]
    if (!word) {
      let en = decodeHTML(key.slice(2, -2))
      word = { en, zh_cn: '', zh_hk: '', ar: '', ja: '', ko: '' }
      dict[key] = word
    }
  }

  writeLangFile(file, dict)
}

function saveLangDict(options: { file: string; json: unknown }) {
  let { file, json } = options

  let dict: LangDict = langDictParser.parse(json)

  if (config.enabled_auto_backup) {
    saveBackup(file)
  }

  writeLangFile(file, dict)
}

function writeLangFile(file: string, dict: LangDict) {
  let text = JSON.stringify(dict, null, 2)
  if (text == '{}') return
  writeFileSync(file, text + '\n')
  autoTranslate({ file, dict })
}

async function autoTranslate(options: { file: string; dict: LangDict }) {
  let { file, dict } = options
  for (let [key, word] of Object.entries(dict)) {
    function save() {
      // load from dict in case it is updated manually in the meantime
      dict = JSON.parse(readFileSync(file).toString())
      dict[key] = word
      writeFileSync(file, JSON.stringify(dict, null, 2) + '\n')
    }

    if (!word.zh_cn) {
      let zh = await en_to_zh(word.en).catch(err => {
        // FIXME: failed to translate, need to find out why
        console.error('failed to translate into zh:', err)
        return ''
      })
      if (zh) {
        word.zh_cn = zh
        save()
      }
    }
    if (!word.zh_hk && word.zh_cn) {
      let zh = await to_hk(word.en, word.zh_cn).catch(err => {
        // FIXME: failed to translate, need to find out why
        console.error('failed to translate into traditional:', err)
        return ''
      })
      if (zh) {
        word.zh_hk = zh
        save()
      }
    }
    if (!word.en || detectLang(word.en) === 'zh') {
      let en = await to_en(word.zh_hk, word.zh_cn).catch(err => {
        // FIXME: failed to translate, need to find out why
        console.error('failed to translate into English:', err)
        return ''
      })
      if (en) {
        word.en = en
        save()
      }
    }
    if (!word.ja) {
      let ja = await en_to_ja(word.en).catch(err => {
        console.error('failed to translate into Japanese:', err)
        return ''
      })
      if (ja) {
        word.ja = ja
        save()
      }
    }
    if (!word.ko) {
      let ko = await en_to_ko(word.en).catch(err => {
        console.error('failed to translate into Korean:', err)
        return ''
      })
      if (ko) {
        word.ko = ko
        save()
      }
    }
    if (!word.ar) {
      let ar = await en_to_ar(word.en).catch(err => {
        // FIXME: failed to translate, need to find out why
        console.error('failed to translate into Arabic:', err)
        return ''
      })
      if (ar) {
        word.ar = ar
        save()
      }
    }
  }
}

function saveBackup(file: string) {
  let mtime: Date
  try {
    let stat = statSync(file)
    mtime = stat.mtime
  } catch (error) {
    // file not exist
    return
  }

  let y = mtime.getFullYear()
  let m = format_2_digit(mtime.getMonth() + 1)
  let d = format_2_digit(mtime.getDate())

  let H = format_2_digit(mtime.getHours())
  let M = format_2_digit(mtime.getMinutes())
  let S = format_2_digit(mtime.getSeconds())

  let ext = extname(file)
  let backup_file =
    file.slice(0, file.length - ext.length) +
    `_bk${y}${m}${d}T${H}${M}${S}${ext}`

  renameSync(file, backup_file)
}

app.delete('/auto-cms/file', guardCMS, (req, res, next) => {
  let pathname = req.header('X-Pathname')
  if (!pathname) {
    res.status(400)
    res.json({ error: 'missing X-Pathname in header' })
    return
  }
  let path = resolvePathname({ site_dir, pathname })
  if ('error' in path) {
    res.status(500)
    res.json({ error: path.error })
    return
  }
  if (!path.exists) {
    res.status(400)
    res.json({ error: 'target file not found' })
    return
  }
  unlinkSync(path.file)
  res.json({ message: 'deleted file' })
})

app.get('/auto-cms/media-list', guardCMS, (req, res, next) => {
  let dir = scanMediaDir(site_dir)
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

function getPkgPublicDir(): string {
  let devDir = resolve(__dirname, '..', 'public')
  if (existsSync(devDir)) return devDir

  let prodDir = resolve(__dirname, '..', '..', 'public')
  if (existsSync(prodDir)) return prodDir

  throw new Error('failed to resolve public directory of auto-cms package')
}
let pkg_public_dir = getPkgPublicDir()

let cms_js_file = resolve(pkg_public_dir, 'auto-cms.js')
app.get('/auto-cms.js', guardCMS, (req, res, next) => {
  res.setHeader('Content-Type', 'application/javascript')
  res.sendFile(cms_js_file)
})

let cms_index_file = resolve(pkg_public_dir, 'auto-cms.html')
app.get('/auto-cms', (req, res, next) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.sendFile(cms_index_file)
})

let multi_lang_file = resolve(pkg_public_dir, 'multi-lang.html')
app.get('/auto-cms/multi-lang', (req, res, next) => {
  res.sendFile(multi_lang_file)
})

let multi_lang_js_file = resolve(pkg_public_dir, 'multi-lang.js')
app.get('/auto-cms/multi-lang.js', (req, res, next) => {
  res.sendFile(multi_lang_js_file)
})

app.get('/auto-cms/langs', (req, res, next) => {
  res.json({ langs: Langs })
})

let site_dir = resolve(env.SITE_DIR)

type MediaFile = {
  dir: string
  filename: string
  size: string
  url: string
  mimetype: string
}

type Dir = {
  url: string
  name: string
  files: MediaFile[]
  dirs: Dir[]
  total_media_count: number
}

function scanMediaDir(dir: string): Dir {
  let result: Dir = {
    url: dir.replace(site_dir, ''),
    name: basename(dir),
    files: [],
    dirs: [],
    total_media_count: 0,
  }
  let filenames = readdirSync(dir)
  for (let filename of filenames) {
    let file = join(dir, filename)
    let stat = statSync(file)
    if (stat.isDirectory()) {
      let dir = scanMediaDir(file)
      if (dir.total_media_count > 0) {
        result.total_media_count += dir.total_media_count
        result.dirs.push(dir)
      }
    } else if (stat.isFile()) {
      let mime = detectFilenameMime(filename)
      if (
        !mime.startsWith('image/') &&
        !mime.startsWith('video/') &&
        !mime.startsWith('audio/')
      ) {
        continue
      }
      let url_dir = dir.replace(site_dir, '')
      if (url_dir == '') {
        url_dir = '/'
      }
      result.files.push({
        dir: url_dir,
        filename,
        size: format_byte(stat.size),
        url: join(url_dir, filename),
        mimetype: mime,
      })
      result.total_media_count++
    }
  }
  return result
}

app.post(
  '/contact',
  express.urlencoded({ extended: false }),
  express.json(),
  (req, res, next) => {
    let error = ''
    try {
      let contact = storeContact(req)
      let entries = Object.entries(contact)
      let text = ``
      let html = ``
      for (let [_key, value] of entries) {
        if (value == null) continue
        let key = _key as keyof Contact
        let label = key
          .replace(/_/g, ' ')
          .replace(/\b\w/g, char => char.toUpperCase())
        if (key == 'submit_time' && typeof value === 'number') {
          let timezone = env.TIMEZONE_HOUR
          let date = new TimezoneDate(value, { timezone })
          value = `${date.toLocaleString()} (GMT+${timezone})`
        }
        if (key == 'lang') {
          value = Langs.find(lang => lang.code == value)?.name || value
        }
        if (value && typeof value === 'object') {
          value = JSON.stringify(value)
        }
        text += `${label}: ${value}\n`
        if (key == 'email') {
          html += `<p>${label}: <a href="mailto:${value}">${value}</a></p>`
        } else {
          html += `<p>${label}: ${value}</p>`
        }
      }
      let site_name = env.ORIGIN.split('://').pop()
      sendEmail({
        from: env.EMAIL_USER,
        to: env.EMAIL_USER,
        subject: 'Contact Form Submission to ' + site_name,
        text,
        html,
      }).catch(err => {
        console.error('failed to send email:', err)
      })
    } catch (e) {
      error = String(e)
    }
    if (req.headers.accept?.includes('json')) {
      if (error) {
        res.status(400)
        res.json({ error })
      } else {
        res.json({ code: 200, ok: true, success: true })
      }
    } else {
      if (env.SUBMIT_CONTACT_RESULT_PAGE == 'default') {
        res.end(/* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Submitted</title>
</head>
<body>
  <p>Your submission has been received.</p>
  ${error ? `<pre><code>${escapeHTML(error)}</code></pre>` : ''}
  <p>Back to <a href="/">home page</a>.</p>
</body>
</html>
`)
      } else {
        res.sendFile(resolve(site_dir, env.SUBMIT_CONTACT_RESULT_PAGE))
      }
    }
  },
)

function escapeHTML(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

// GET site file
app.use((req, res, next) => {
  if (req.method !== 'GET') {
    next()
    return
  }

  // "/_next/image?url=abc.jpeg&w=80&q=50" -> "/_next/image/url=abc.jpeg&w=80&q=50"
  if (req.path === '/_next/image') {
    let dir = join(env.SITE_DIR, '/_next/image')
    let filenames = readdirSync(dir)
    find_file: for (let filename of filenames) {
      let params = new URLSearchParams(filename)
      for (let [key, value] of params.entries()) {
        if (req.query[key] != value) {
          continue find_file
        }
      }
      let file = resolve(join(dir, filename))
      let url = params.get('url')!.toLowerCase()
      let ext = extname(url)
      if (ext == '.jpg') ext = '.jpeg'
      if (ext) res.setHeader('Content-Type', 'image/' + ext.replace('.', ''))
      sendFile(res, file)
      return
    }
  }

  try {
    let path = resolvePathname({ site_dir, pathname: req.path })
    if ('error' in path) {
      next(path.error)
      return
    }
    if (!path.exists) {
      next()
      return
    }
    let file = path.file
    let ext = extname(file)
    if (ext == '.html') {
      let content = readFileSync(file)
      sendHTML(req, res, content, file)
      return
    }
    if (ext == '') {
      let content = readFileSync(file)
      if (isHTMLInBuffer(content)) {
        sendHTML(req, res, content, file)
        return
      }
      sendBuffer(res, content)
      return
    }
    sendFile(res, file)
  } catch (error) {
    next(error)
  }
})

function get404File(): string | null {
  let file = resolve(site_dir, '404.html')
  if (existsSync(file)) return file

  file = resolve(site_dir, '404/index.html')
  if (existsSync(file)) return file

  file = resolve(site_dir, '404')
  if (existsSync(file)) return file

  file = resolve(site_dir, 'index.html')
  if (existsSync(file)) return file

  return null
}

// 404 page
app.use((req, res, next) => {
  res.status(404)
  let file = get404File()
  if (file) {
    let content = readFileSync(file)
    sendHTML(req, res, content, file)
  } else {
    next()
  }
})

let prefix_doctype = '<!DOCTYPE html>'.toLowerCase()
let prefix_html = '<html'.toLowerCase()

function isHTMLInBuffer(content: Buffer): boolean {
  return (
    isBufferStartsWith(content, prefix_doctype) ||
    isBufferStartsWith(content, prefix_html)
  )
}

function isBufferStartsWith(content: Buffer, prefix: string): boolean {
  if (content.length < prefix.length) return false
  return content.subarray(0, prefix.length).toString().toLowerCase() == prefix
}

// required to apply `sessionMiddleware` and `cookieMiddleware` before calling this function
function sendHTML(
  req: Request,
  res: Response,
  content: Buffer | string,
  file: string,
) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')

  if (req.session.auto_cms_enabled) {
    res.write(content)
    res.end('<script src="/auto-cms.js"></script>')
    return
  }

  let lang: Lang | null = null
  if (config.enabled_multi_lang) {
    lang = req.cookies.lang
    if (!lang) {
      lang = env.AUTO_CMS_DEFAULT_LANG
      res.cookie('lang', lang)
    }
  }

  if (config.enabled_template) {
    content = applyTemplates({
      site_dir,
      html: content.toString(),
      file,
      lang,
    })
  }

  if (lang) {
    content = translateHTML({
      html: content.toString(),
      file: file + LangFileSuffix,
      lang,
    })
  }

  res.end(content)
}

function sendBuffer(res: Response, content: Buffer) {
  // FIXME need to set content-type manually?
  res.write(content)
  res.end()
}

function sendFile(res: Response, file: string) {
  // FIXME need to set content-type manually?
  res.sendFile(file)
}

let port = env.PORT
app.listen(port, () => {
  print(port)
})
