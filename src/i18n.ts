import { autoStartServer, patchedTranslate } from 'node-easynmt'
import debug from 'debug'
import { env } from './env'
import { readFileSync } from 'fs'
import { encodeHTML } from './html'
import { array, enums, literal, object, string } from 'cast.ts'
import { TaskQueue } from '@beenotung/tslib/task/task-queue'

let log = debug('auto-cms:i18n')
log.enabled = env.NODE_ENV == 'development'

// FIXME: investigate error when translating: New Generative Tool For 3D Scenes launch soon!
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
  let out_text = await patchedTranslate({
    ...options,
    debug: log.enabled,
  })
  log('translate:', { out_text })
  return out_text
}

let zhConvertResultParser = object({
  code: literal(0),
  data: object({
    converter: enums([
      'Simplified', // 簡體化
      'Traditional', // 繁體化
      'China', // 中國化
      'Hongkong', // 香港化
      'Taiwan', // 台灣化
      'Pinyin', // 拼音化
      'Bopomofo', // 注音化
      'Mars', // 火星化
      'WikiSimplified', // 維基簡體化
      'WikiTraditional', // 維基繁體化
    ]),
    text: string(),
    textFormat: literal('PlainText'),
    usedModules: array(string()),
  }),
  revisions: object({ build: string(), msg: string() }),
})

// zh_cn -> zh_hk
let zhCache = new Map<string, Promise<string>>()
let zhTaskQueue = new TaskQueue()

export async function translateIntoTraditional(zh_cn: string) {
  if (!zh_cn.trim()) return zh_cn

  // use cache to avoid unnecessary call to external service
  let zh_hk = zhCache.get(zh_cn)
  if (!zh_hk) {
    // use task queue to avoid overload the external service with concurrent requests
    zh_hk = zhTaskQueue.runTask(() => {
      log('translate zh:', { zh_cn })
      return fetch('https://api.zhconvert.org/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: zh_cn, converter: 'Traditional' }),
      })
        .then(res => res.json())
        .then(json => zhConvertResultParser.parse(json).data.text)
        .then(zh_hk => {
          log('translate zh:', { zh_hk })
          return zh_hk
        })
    })
    zhCache.set(zh_cn, zh_hk)
  }

  return await zh_hk
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

export type Lang = 'en' | 'zh_cn' | 'zh_hk'

// lang -> text content
export type LangText = Record<Lang, string>

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
