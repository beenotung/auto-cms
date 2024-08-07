import { autoStartServer, patchedTranslate } from 'node-easynmt'
import debug from 'debug'
import { env } from './env'
import { readFileSync } from 'fs'
import { encodeHTML } from './html'
import { Parser, array, dict, enums, literal, object, string } from 'cast.ts'
import { TaskQueue } from '@beenotung/tslib/task/task-queue'
import { TranslateLanguageData } from 'open-google-translator'
import { memorize } from '@beenotung/tslib/memorize'

let log = debug('auto-cms:i18n')
log.enabled = env.NODE_ENV == 'development'

let googleTranslateQueue = new TaskQueue()

export let en_to_zh = memorize(async (en: string): Promise<string> => {
  if (!en.trim()) return en

  log('en_to_zh:', { en })

  let zh: string
  try {
    let data = await googleTranslateQueue.runTask(() =>
      TranslateLanguageData({
        listOfWordsToTranslate: [en],
        fromLanguage: 'en',
        toLanguage: 'zh-cn',
      }),
    )
    zh = data[0].translation
    if (!zh) throw 'empty translate result'
  } catch (error) {
    zh = await translateIntoSimplified(en)
  }

  log('en_to_zh:', { zh })

  return zh
})

export let to_hk = memorize(async (en: string, zh: string): Promise<string> => {
  if (!en.trim()) return en
  if (!zh.trim()) return zh

  let hk: string
  try {
    log('to_hk:', { en })
    let data = await googleTranslateQueue.runTask(() =>
      TranslateLanguageData({
        listOfWordsToTranslate: [en],
        fromLanguage: 'en',
        toLanguage: 'zh-tw',
      }),
    )
    hk = data[0].translation
  } catch (error) {
    log('to_hk:', { zh })
    hk = await translateIntoTraditional(zh)
  }

  log('to_hk:', { hk })

  return hk
})

// FIXME: investigate error when translating: New Generative Tool For 3D Scenes launch soon!
// FIXME: handle repeated output, e.g. 'YOLOv:' -> 'YOLOV: (YOLOV): (YOLOV): (YOLOV): (YOLOV): (YOLOV): (YOLOV): (YOLOV): (YOLOV): (YOLOV): (YOLOV): (YOLOV): (YOLOV): (YOLOV:) (YOLOV:) (YOLOV): (YOLOV:) (YOLOV:) (YOLOV:) (YOLOV:) (YOLOV:) (YOLOV:) (YOLOV:) (YOLOV:) (YOLOV:) (YOLOV:) (YOLOV:) (YOLOV:) (YOLOV:) (YOLOV:) (YOLOV:) (YOLOV:) (YOL:) (YOLOV:) (YOLOV:) (YOL:) (YOL:) (YOLOV:) (YOL:) (YOLOV:)'
async function translateIntoSimplified(en: string) {
  log('translate:', { en })
  let out_text = await patchedTranslate({
    text: en,
    target_lang: 'zh',
    source_lang: 'en',
    cached: false,
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
let zhTaskQueue = new TaskQueue()

async function translateIntoTraditional(zh_cn: string): Promise<string> {
  if (!zh_cn.trim()) return zh_cn

  // use task queue to avoid overload the external service with concurrent requests
  return zhTaskQueue.runTask(() => {
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
}

export function extractWrappedText(html: string): string[] {
  let matches = html.match(/{{(.*?)}}/gms)
  return matches || []
}

export let LangFileSuffix = '.json'

// key with {{ }} -> LangText
export type LangDict = Record<string, LangText>

export type Lang = 'en' | 'zh_cn' | 'zh_hk'

// lang -> text content
export type LangText = Record<Lang, string>

export let langDictParser = dict({
  key: string(),
  value: dict({
    key: string({ sampleValues: ['en', 'zh_cn', 'zh_hk'] }) as Parser<Lang>,
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
    html = html.replaceAll(key, encodeHTML(text).replaceAll('&nbsp;', ' '))
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
    console.error(
      'Warning: Failed to start EasyNMT docker container for multi language translation.',
      String(error),
    )
  }
}
