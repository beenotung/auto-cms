import { readFileSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { Lang, LangFileSuffix, translateHTML } from './i18n'

export function applyTemplates(options: {
  site_dir: string
  html: string
  file: string
  lang: Lang | null
}): string {
  let { site_dir, html, lang } = options
  let dir = dirname(options.file)

  for (;;) {
    let found = false
    let matches = html.match(/{\[(.*?)\]}/g) || []
    for (let key of matches) {
      // e.g. '{[_.KEY]:value, arr: []}'
      if (key.includes(']')) {
        continue
      }

      // e.g. '{[/header.html]}'
      // e.g. '{[header.html]}'
      let pathname = key.slice(2, -2)
      let file =
        pathname[0] == '/'
          ? resolve(join(site_dir, pathname))
          : resolve(join(dir, pathname))

      if (!file.startsWith(site_dir)) {
        html = html.replace(key, '')
        continue
      }

      let template = readFileSync(file).toString()
      if (lang) {
        template = translateHTML({
          html: template,
          file: file + LangFileSuffix,
          lang: lang,
        })
      }
      html = html.replace(key, template)

      found = true
    }

    if (!found) break
  }

  return html
}
