import { LangDict } from '../src/i18n'
import { fetch_json, resolveFilePathname } from './api'

declare var pathnameNode: HTMLElement
declare var errorNode: HTMLElement
declare var tableBody: HTMLElement

async function init() {
  try {
    const params = new URLSearchParams(window.location.search)
    const pagePathname = params.get('pathname')
    if (!pagePathname) {
      throw 'missing pathname in location.search'
    }
    pathnameNode.textContent = pagePathname

    let path = await resolveFilePathname(pagePathname)
    let jsonPathname = path.pathname + '.json'
    pathnameNode.textContent = jsonPathname

    let dict = await fetch_json<LangDict>(jsonPathname, {})
    let tr = tableBody.querySelector<HTMLElement>('tr')!
    tr.remove()

    for (let [key, word] of Object.entries(dict)) {
      tr = tr.cloneNode(true) as HTMLElement
      console.log(tr.outerHTML)
      tr.querySelector('[data-text="key"]')!.textContent = key
      tr.querySelector<HTMLInputElement>('[data-value="en"]')!.value = word.en
      tr.querySelector<HTMLInputElement>('[data-value="zh_cn"]')!.value =
        word.zh_cn || ''
      tr.querySelector<HTMLInputElement>('[data-value="zh_hk"]')!.value =
        word.zh_hk || ''
      tableBody.appendChild(tr)
    }
  } catch (error) {
    console.error(error)
    errorNode.textContent = String(error)
  }
}

init()
