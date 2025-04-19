import type { Lang, LangDict, Langs, LangText } from '../src/i18n'
import { fetch_json, resolveFilePathname } from './api'

declare var pathnameNode: HTMLElement
declare var errorMessage: HTMLElement
declare var tableHeader: HTMLElement
declare var tableBody: HTMLElement
declare var saveButton: HTMLButtonElement

let trTemplate = tableBody.querySelector<HTMLElement>('tr')!

async function init() {
  try {
    errorMessage.textContent = 'Loading langs...'
    let { langs } = await fetch_json<{ langs: typeof Langs }>(
      '/auto-cms/langs',
      {},
    )
    for (let lang of langs) {
      let th = document.createElement('th')
      th.textContent = lang.name
      tableHeader.appendChild(th)

      let td = document.createElement('td')
      let textarea = document.createElement('textarea')
      textarea.dataset.value = lang.code
      td.appendChild(textarea)
      trTemplate.appendChild(td)
    }

    errorMessage.textContent = 'Resolving pathname...'

    const params = new URLSearchParams(window.location.search)
    const pagePathname = params.get('pathname')
    if (!pagePathname) {
      throw 'missing pathname in location.search'
    }
    pathnameNode.textContent = pagePathname

    let path = await resolveFilePathname(pagePathname)
    let jsonPathname = path.pathname + '.json'
    pathnameNode.textContent = jsonPathname

    errorMessage.textContent = 'Loading language translations...'

    let dict = await fetch_json<LangDict>(jsonPathname, {})
    let keySpanTemplate =
      trTemplate.querySelector<HTMLSpanElement>('[data-text="key"]')!

    trTemplate.hidden = false
    for (let [key, word] of Object.entries(dict)) {
      let tr = trTemplate.cloneNode(true) as HTMLElement
      let keySpan = tr.querySelector<HTMLSpanElement>('[data-text="key"]')!
      keySpan.textContent = key
      keySpanTemplate.textContent = key
      let rect = keySpanTemplate.getBoundingClientRect()
      let minHeight = rect.height * 1.25 + 'px'
      for (let [lang, value] of Object.entries(word)) {
        let input = tr.querySelector<HTMLTextAreaElement>(
          `[data-value="${lang}"]`,
        )!
        input.value = value
        input.style.minHeight = minHeight
      }
      tableBody.appendChild(tr)
    }
    trTemplate.hidden = true

    async function save() {
      saveButton.textContent = 'Saving...'
      saveButton.disabled = true
      saveButton.style.color = 'unset'
      try {
        let dict: LangDict = {}
        let rows = tableBody.querySelectorAll('tr')
        for (let row of rows) {
          let key = row.querySelector('[data-text="key"]')!.textContent!
          let word = {} as LangText
          let inputs = row.querySelectorAll<HTMLTextAreaElement>('textarea')
          for (let input of inputs) {
            let lang = input.dataset.value as Lang
            let value = input.value
            word[lang] = value
          }
          dict[key] = word
        }
        await fetch_json('/auto-cms/file', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Pathname': jsonPathname,
          },
          body: JSON.stringify(dict),
        })
        saveButton.disabled = false
        saveButton.textContent = 'Saved'
        saveButton.style.color = 'green'
      } catch (error) {
        saveButton.disabled = false
        saveButton.textContent = String(error)
        saveButton.style.color = 'red'
      }
    }
    saveButton.onclick = save

    errorMessage.hidden = true
  } catch (error) {
    console.error(error)
    errorMessage.textContent = String(error)
    errorMessage.hidden = false
  }
}

init()
