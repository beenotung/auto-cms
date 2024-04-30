import { autoStartServer, patchedTranslate } from 'node-easynmt'
import debug from 'debug'
import { env } from './env'
import { readFileSync } from 'fs'
import { encodeHTML } from './html'

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

export async function translateTraditional(char: string) {

  let api_addr = 'https://api.zhconvert.org/convert'

  // api params
  let text = char
  let converter = 'Traditional'

  try {
    const request = await fetch(api_addr, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, converter }),
    })

    const response = await JSON.parse(await request.text())

    if (response.code !== 0) {
      console.error('Failed to translate (zh_cn to zh_hk):', char)
      return char
    }else{
      let result = JSON.stringify(response.data.text)

      // remove the quotes
      result = result.substring(1, result.length - 1)

      console.log('Translated (zh_cn to zh_hk):', char, '->', result)
      return result
    }

  }catch(error){
    console.error('Failed to translate (zh_cn to zh_hk):', char)
    return char
  }
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
