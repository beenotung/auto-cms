import { translate } from 'node-easynmt'
import { TaskQueue } from '@beenotung/tslib/task/task-queue'
import debug from 'debug'
import { env } from './env'
import { readFileSync } from 'fs'
import { encodeHTML } from './html'

let log = debug('auto-cms:i18n')
log.enabled = env.NODE_ENV == 'development'

// target_lang -> in_text -> out_text
let lang_cache = new Map<string, Map<string, string>>()

let queue = new TaskQueue()

export function translateText(options: {
  /** @description without {{ }} */
  text: string
  target_lang: string
  /** @description auto detect if not specified */
  source_lang?: string
}) {
  return queue.runTask(async () => {
    let { text: in_text, target_lang } = options

    if (!in_text.trim()) return in_text

    let cache = lang_cache.get(target_lang)
    if (!cache) {
      cache = new Map()
      lang_cache.set(target_lang, cache)
    }

    let out_text = cache.get(in_text)
    if (out_text) return out_text

    log('translate:', { in_text })

    let wrapped_in_text = in_text
    if (!in_text.endsWith('.')) {
      wrapped_in_text += '.'
    }
    if (isUpperCase(in_text[0]) && !isUpperCase(in_text[1])) {
      wrapped_in_text =
        wrapped_in_text[0].toLocaleLowerCase() + wrapped_in_text.slice(1)
    }

    out_text = await translate({
      text: wrapped_in_text,
      target_lang,
      source_lang: options.source_lang,
    })
    if (
      !in_text.endsWith('.') &&
      (out_text.endsWith('.') || out_text.endsWith('。'))
    ) {
      out_text = out_text.slice(0, -1)
    }

    log('translate:', { out_text })

    cache.set(in_text, out_text)

    return out_text
  })
}

function isUpperCase(char: string) {
  return char && char.toLocaleUpperCase() == char
}

export function extractWrappedText(html: string): string[] {
  let matches = html.match(/{{(.*?)}}/g)
  return matches || []
}

export let LangFileSuffix = '.json'

export type LangDict = Record<string, LangText>

export type LangText = {
  en: string
  zh: string
}

export function loadLangFile(file: string) {
  try {
    let text = readFileSync(file).toString()
    return JSON.parse(text) as LangDict
  } catch (error) {
    // file not found
    return null
  }
}

export function translateHTML(options: {
  html: string
  file: string
  lang: 'en' | 'zh'
}): string {
  let { html, file, lang } = options

  let dict = loadLangFile(file)
  if (!dict) return html

  let matches = extractWrappedText(html)
  for (let key of matches) {
    let word = dict[key]
    if (!word) continue
    let text = word[lang]
    if (!text) continue
    html = html.replaceAll(key, encodeHTML(text))
  }

  return html
}
