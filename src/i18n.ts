import { autoStartServer, patchedTranslate } from 'node-easynmt'
import debug from 'debug'
import { env } from './env'
import { readFileSync } from 'fs'
import { encodeHTML } from './html'
import { Parser, array, dict, enums, literal, object, string } from 'cast.ts'

let log = debug('auto-cms:i18n')
log.enabled = env.NODE_ENV == 'development'

export async function translateText(options: {
  /** @description without {{ }} */
  text: string
  /** @example 'zh' */
  target_lang: string
  /** @description auto detect if not specified */
  source_lang?: string
}) {
  let in_text = options.text
  log('translate:', { in_text })
  let out_text = await patchedTranslate(options)
  log('translate:', { out_text })
  return out_text
}

function isUpperCase(char: string) {
  return char && char.toLocaleUpperCase() == char
}

export function extractWrappedText(html: string): string[] {
  let matches = html.match(/{{(.*?)}}/g)
  return matches || []
}

export let LangFileSuffix = '.json'

// key with {{ }} -> LangText
export type LangDict = Record<string, LangText>

export type Lang = 'en' | 'zh'

// lang -> text content
export type LangText = Record<Lang, string>

export let langDictParser = dict({
  key: string(),
  value: dict({
    key: string({ sampleValues: ['en', 'zh'] }) as Parser<Lang>,
    value: string(),
  }),
})

export function loadLangFile(file: string): LangDict | null {
  try {
    let text = readFileSync(file).toString()
    let json = JSON.parse(text)
    return langDictParser.parse(json)
  } catch (error) {
    // file not found
    return null
  }
}

export function translateHTML(options: {
  html: string
  file: string
  lang: Lang
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

export async function setupEasyNMT() {
  try {
    await autoStartServer({
      debug: env.NODE_ENV == 'development',
    })
  } catch (error) {
    // i18n module is optional, fine to continue without halt
    console.error(error)
  }
}
