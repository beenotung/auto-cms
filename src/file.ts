import { existsSync, mkdirSync, statSync } from 'fs'
import { join, resolve } from 'path'

/**
 * 0. ../file -> reject (out of site directory)
 * 1. /contact.html -> /contact.html
 * 2. /contact -> /contact (if file exists without extension)
 * 3. /contact -> /contact/index.html (if dir exists)
 * 4. /contact -> /contact.html (if .html file exists without extension)
 * 5. /contact -> /contact/index.html (if not exists without extension)
 */
export function resolvePathname(options: {
  site_dir: string
  pathname: string
  mkdir?: boolean
}):
  | { error: string }
  | {
      file: string
      exists: boolean
    } {
  let { site_dir, pathname } = options
  pathname = decodeURIComponent(options.pathname)

  // use `resolve(join())` instead of `resolve()` to avoid resolving `/` pathname as root directory
  let file = resolve(join(site_dir, pathname))

  // 0. ../file -> reject (out of site directory)
  if (!file.startsWith(site_dir)) {
    return { error: 'resolved pathname is out of the site directory' }
  }

  // 1. /contact.html -> /contact.html
  if (file.endsWith('.html')) {
    return { file, exists: existsSync(file) }
  }

  try {
    let stat = statSync(file)

    // 2. /contact -> /contact (if file exists without extension)
    if (stat.isFile()) {
      return { file, exists: true }
    }

    // 3. /contact -> /contact/index.html (if dir exists)
    if (stat.isDirectory()) {
      file = join(file, 'index.html')
      return { file, exists: existsSync(file) }
    }

    // e.g. socket file descriptor
    return { error: 'unsupported file type' }
  } catch (error) {
    // 4. /contact -> /contact.html (if .html file exists without extension)
    {
      let html_file = file + '.html'
      if (existsSync(html_file)) {
        return { file: html_file, exists: true }
      }
    }

    // 5. /contact -> /contact/index.html (if not exists without extension)
    {
      let dir = file
      if (options.mkdir) {
        mkdirSync(dir, { recursive: true })
      }
      let index_file = join(dir, 'index.html')
      return { file: index_file, exists: false }
    }
  }
}
