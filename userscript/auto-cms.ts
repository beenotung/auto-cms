import { wrapText } from './i18n'

export let version = '0.1.16'

let win = window as any
win.auto_cms = { version }

window.addEventListener('contextmenu', onContextMenu, {
  capture: true,
  passive: false,
})
window.addEventListener('click', onContextMenu, {
  capture: true,
  passive: false,
})

function onContextMenu(event: MouseEvent) {
  if (!(event.altKey || event.ctrlKey)) {
    return
  }
  let target = event.target
  if (!(target instanceof HTMLElement)) {
    return
  }
  event.preventDefault()
  event.stopImmediatePropagation()
  let menu = new AutoCMSMenu()
  menu.show(event, target)
}

function ask<E extends Node>(
  message: string,
  e: E,
  key: keyof E & string,
  flag?: 'remove',
) {
  if (e instanceof Element && e.hasAttribute(key)) {
    let ans = prompt(message, e.getAttribute(key) as string)
    if (ans == null) return
    if (ans) {
      e.setAttribute(key, ans)
    } else if (flag == 'remove') {
      e.removeAttribute(key)
    }
  } else {
    let ans = prompt(message, e[key] as string)
    if (ans) {
      ;(e as any)[key] = ans
    }
  }
}

function exportHTML() {
  let doc = document.documentElement.cloneNode(true) as HTMLElement
  let body = doc.querySelector('body')!

  // remove Tridactyl
  doc.querySelector('iframe#cmdline_iframe')?.remove()
  doc.querySelector('.TridactylStatusIndicator')?.remove()
  for (let style of doc.querySelectorAll('style')) {
    let text = style.textContent
    if (
      text &&
      text.includes('@media print') &&
      text.includes('.TridactylStatusIndicator')
    ) {
      style.remove()
      continue
    }
    if (
      text &&
      text.includes('.cleanslate') &&
      text.includes('.TridactylStatusIndicator')
    ) {
      style.remove()
      continue
    }
  }

  // remove Video Speed Controller
  if (body.classList.contains('vsc-initialized')) {
    body.classList.remove('vsc-initialized')
    if (body.classList.length == 0) {
      body.removeAttribute('class')
    }
  }

  // remove auto-cms
  doc.querySelector('script[src="/auto-cms.js"]')?.remove()
  doc.querySelector('auto-cms-status')?.remove()
  doc.querySelector('auto-cms-menu')?.remove()
  doc.querySelector('style[auto-cms]')?.remove()

  // fix doctype
  let html = '<!DOCTYPE html>\n' + doc.outerHTML

  // fix head newline
  html = html.replace('<head', '\n  <head')

  // fix body newline
  while (html.includes('\n</body>')) {
    html = html.replace('\n</body>', '</body>')
  }
  html = html.replace('</body></html>', '</body>\n</html>')

  // fix self-closing tags
  html = html.replace(/(<link .*?)>/g, (_, match) => match + ' />')
  html = html.replace(/(<meta .*?)>/g, (_, match) => match + ' />')
  html = html.replace(/(<img .*?)>/g, (_, match) => match + ' />')
  html = html.replace(/(<input .*?)>/g, (_, match) => match + ' />')

  return html
}

function toTagText(target: HTMLElement): string {
  return target.outerHTML.replace(target.innerHTML, '').split('</')[0]
}

function appendToHead(node: Node) {
  if (!document.head) {
    document.body.parentElement!.appendChild(document.createElement('head'))
  }
  document.head.appendChild(node)
}

function getHighestZIndex() {
  let max = 0
  function walk(element: Element) {
    let current = +getComputedStyle(element).zIndex
    if (current > max) {
      max = current
    }
    for (let child of element.children) {
      walk(child)
    }
  }
  walk(document.body)
  return max
}

async function fetch_json<T>(url: string, init: RequestInit) {
  return fetch(url, init)
    .then(res => res.json().catch(err => ({ error: res.statusText })))
    .then(json => {
      if (json.error) {
        throw json.error
      }
      return json as T
    })
}

class AutoCMSMenu extends HTMLElement {
  static instance?: AutoCMSMenu

  shadowRoot: ShadowRoot

  target?: HTMLElement

  teardownFns: Array<() => void> = []

  constructor() {
    super()
    this.shadowRoot = this.attachShadow({ mode: 'open' })

    let style = document.createElement('style')
    style.innerHTML = /* css */ `
  :host {
    position: fixed;
    border: 1px solid black;
    border-radius: 0.25rem;
    background-color: white;
    color: black;
    overflow: hidden;
    z-index: ${getHighestZIndex() + 1};
    overflow: auto;
  }
  .auto-cms-menu--section {
    padding: 0.25rem;
  }
  .auto-cms-menu--section:hover {
    background-color: wheat;
  }
  .auto-cms-menu--list {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .auto-cms-menu--list button {
    width: 100%;
    padding: 0.25rem 0.5rem;
  }
  .auto-cms-menu--title {
    font-weight: bold;
    margin-top: 0.5rem;
    margin-bottom: 0.25rem;
  }
`
    this.appendChild(style)
  }

  flushTeardownFns() {
    this.teardownFns.forEach(fn => fn())
    this.teardownFns.length = 0
  }

  wrapTeardownFn(fn: () => void) {
    let toggle = () => {
      let index = this.teardownFns.indexOf(fn)
      if (index == -1) {
        this.teardownFns.push(fn)
      } else {
        this.teardownFns.splice(index, 1)
      }
    }
    return { toggle, fn }
  }

  appendChild<T extends Node>(node: T): T {
    return this.shadowRoot.appendChild(node)
  }

  connectedCallback() {
    const target = this.target
    if (!target) return
    window.addEventListener('click', this.handleWindowClick, {
      capture: true,
      passive: false,
    })

    let updateSection = this.addSection('Update')
    for (let node of target.childNodes) {
      if (node instanceof HTMLBRElement) {
        let br = node
        let remove = this.wrapTeardownFn(() => {
          br.remove()
          button.remove()
        })
        let { button } = this.addMenuItem(
          updateSection,
          'Remove <br>',
          event => {
            if (!br.hidden) {
              br.hidden = true
              button.textContent = 'Undo'
            } else {
              br.hidden = false
              button.textContent = 'Remove <br>'
            }
            remove.toggle()
          },
        )
      } else if (node.nodeType === Node.TEXT_NODE && node.nodeValue?.trim()) {
        let text = node.nodeValue.trim()
        if (text.length > 7) {
          text = text.slice(0, 7) + '...'
        }
        this.addMenuItem(updateSection, 'Text: ' + text, event => {
          let ans = prompt('text content (empty to remove)', node.nodeValue!)
          if (ans == null) return
          if (ans) {
            node.nodeValue = ans
          } else {
            node.remove()
          }
        })
        this.addMenuItem(updateSection, 'Add <br> and text', event => {
          let br = document.createElement('br')
          node.after(br)
          let ans = prompt('new text')
          if (ans) {
            br.after(ans)
          }
        })
      }
    }
    const a = target.closest('a')
    if (a) {
      this.addMenuItem(updateSection, 'Link', event => {
        ask('hyperlink', a, 'href')
      })
    }
    if (target instanceof HTMLImageElement) {
      this.addMenuItem(updateSection, 'Image', event => {
        ask('image src', target, 'src')
        ask('image srcset', target, 'srcset', 'remove')
      })
    }
    if (target instanceof HTMLAudioElement) {
      this.addMenuItem(updateSection, 'Audio', event => {
        ask('audio link', target, 'src')
      })
    }
    if (target instanceof HTMLVideoElement) {
      this.addMenuItem(updateSection, 'Video', event => {
        ask('video link', target, 'src')
      })
    }

    let copySection = this.addSection('Copy')
    this.addMenuItem(copySection, 'Advanced Mode', event => {
      alert(
        'right click > inspect > right-click element > click "Edit As HTML" > copy and paste',
      )
    })
    this.addMenuItem(copySection, 'Easy Mode', event => {
      let addTarget = (target: HTMLElement, index: number) => {
        if (target == document.body) return
        let targetText = `${index}: ${toTagText(target)}`
        let clonedTarget: HTMLElement | null = null
        let { button } = this.addMenuItem(copySection, targetText, event => {
          if (clonedTarget) {
            clonedTarget.remove()
            clonedTarget = null
            button.textContent = targetText
          } else {
            clonedTarget = target.cloneNode(true) as HTMLElement
            let parent = target.parentElement!
            if (parent.lastElementChild === target) {
              parent.appendChild(clonedTarget)
            } else {
              target.insertAdjacentElement('afterend', clonedTarget)
            }
            button.textContent = 'Undo'
          }
        })
        button.style.textAlign = 'start'
        if (target.parentElement) {
          addTarget(target.parentElement, index + 1)
        }
      }
      addTarget(target, 1)
    })

    let removeSection = this.addSection('Remove')
    this.addMenuItem(removeSection, 'Advanced Mode', event => {
      alert('right click > inspect > right-click element > click "Delete Node"')
    })
    this.addMenuItem(removeSection, 'Easy Mode', event => {
      let addTarget = (target: HTMLElement, index: number) => {
        if (target == document.body) return
        let targetText = `${index}: ${toTagText(target)}`
        let remove = this.wrapTeardownFn(() => {
          target.remove()
          button.remove()
        })
        let { button } = this.addMenuItem(removeSection, targetText, event => {
          if (!target.hidden) {
            target.hidden = true
            button.textContent = 'Undo'
          } else {
            target.hidden = false
            button.textContent = targetText
          }
          remove.toggle()
        })
        button.style.textAlign = 'start'
        if (target.parentElement) {
          addTarget(target.parentElement, index + 1)
        }
      }
      addTarget(target, 1)
    })

    let i18nSection = this.addSection('i18n')
    this.addMenuItem(i18nSection, 'Extract Text', event => {
      let extractText = (node: Node) => {
        // wrap text node with {{ }}
        if (node.nodeType === Node.TEXT_NODE) {
          let text = node.nodeValue?.trim()
          if (!text) return

          if (text.includes('{{') && text.includes('}}')) return

          let wrappedText = wrapText(node.nodeValue!)
          if (wrappedText) {
            node.nodeValue = wrappedText
          }

          return
        }

        // exclude script, style, noscript, and auto-cms elements
        if (
          node instanceof HTMLScriptElement ||
          node instanceof HTMLStyleElement ||
          node.nodeName.toLocaleLowerCase() == 'noscript' ||
          node instanceof AutoCMSStatus
        ) {
          return
        }

        // recursively loop child nodes
        for (let child of node.childNodes) {
          extractText(child)
        }
      }
      extractText(document.body)
    })

    let iframeSection = this.addSection('Iframe')
    this.addMenuItem(iframeSection, 'Expand', event => {
      let iFrames = document.getElementsByTagName('iframe')
      for (let iframe of iFrames) {
        let outerHTML = iframe.outerHTML
        let { button } = this.addMenuItem(iframeSection, outerHTML, event => {
          let div = document.createElement('div')

          // copy attributes from iframe to div
          {
            let n = iframe.attributes.length
            for (let i = 0; i < n; i++) {
              let attr = iframe.attributes.item(i)!
              div.setAttribute(attr.name, attr.value)
            }
          }
          // copy inner HTML from iframe to div
          {
            let innerHTML = iframe.contentWindow?.document.body.innerHTML
            if (innerHTML) {
              div.innerHTML = innerHTML
            }
          }

          iframe.replaceWith(div)

          button.remove()
        })
      }
    })

    let metaSection = this.addSection('Meta for SEO')
    this.addMenuItem(metaSection, 'Page Title', event => {
      let og_meta = document.querySelector('meta[property="og:title"]')
      let twitter_meta = document.querySelector('meta[name="twitter:title"]')
      let ans = prompt(
        'Page title for SEO (keep it under 60 characters):',
        twitter_meta?.getAttribute('content') ||
          og_meta?.getAttribute('content') ||
          document.title,
      )
      if (!ans) return
      twitter_meta?.remove()
      og_meta?.remove()
      document.title = ans
    })
    this.addMenuItem(metaSection, 'Page Description', event => {
      let meta = document.querySelector('meta[name="description"]')
      let og_meta = document.querySelector('meta[property="og:description"]')
      let twitter_meta = document.querySelector(
        'meta[name="twitter:description"]',
      )
      let ans = prompt(
        'Page description for SEO (keep it between 155 - 160 characters):',
        twitter_meta?.getAttribute('content') ||
          og_meta?.getAttribute('content') ||
          meta?.getAttribute('content') ||
          '',
      )
      if (!ans) return
      twitter_meta?.remove()
      og_meta?.remove()
      if (!meta) {
        meta = document.createElement('meta')
        meta.setAttribute('name', 'description')
        appendToHead(meta)
      }
      meta.setAttribute('content', ans)
    })
    this.addMenuItem(metaSection, 'Preview Image', event => {
      let og_meta = document.querySelector('meta[property="og:image"]')
      let twitter_meta = document.querySelector('meta[name="twitter:image"]')
      let ans = prompt(
        'Preview image for SEO (recommended 1200x630px):',
        twitter_meta?.getAttribute('content') ||
          og_meta?.getAttribute('content') ||
          '',
      )
      if (!ans) return
      twitter_meta?.remove()
      if (!og_meta) {
        og_meta = document.createElement('meta')
        og_meta.setAttribute('property', 'og:image')
        appendToHead(og_meta)
      }
      og_meta.setAttribute('content', ans)
    })

    let cmsSection = this.addSection('CMS')
    this.addMenuItem(cmsSection, 'Save', async event => {
      let button = event.target as HTMLButtonElement
      try {
        button.textContent = 'Saving'
        this.flushTeardownFns()
        await fetch_json('/auto-cms/file', {
          method: 'PUT',
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'X-Pathname': location.pathname,
          },
          body: exportHTML(),
        })
        button.textContent = 'Saved'
      } catch (error) {
        alert(String(error))
        button.textContent = 'Save'
      }
    })
    this.addMenuItem(cmsSection, 'Save Unmodified As', async event => {
      let button = event.target as HTMLButtonElement
      let pathname = prompt('Pathname:', location.pathname)
      if (!pathname) return
      let res = await fetch(pathname)
      if (res.status == 200) {
        let ans = confirm(`Confirm to override file: ${pathname} ?`)
        if (!ans) return
      } else {
        let ans = confirm(`Confirm to save to new file" ${pathname} ?`)
        if (!ans) return
      }
      try {
        button.textContent = 'Saving'
        await fetch_json('/auto-cms/file/copy', {
          method: 'PUT',
          headers: {
            'X-From-Pathname': location.pathname,
            'X-To-Pathname': pathname,
          },
        })
        button.textContent = 'Saved'
      } catch (error) {
        alert(String(error))
        button.textContent = 'Save Unmodified As'
      }
    })
    this.addMenuItem(cmsSection, 'Show Files', event => {
      let url = location.origin + location.pathname
      if (!url.endsWith('/')) {
        url += '/'
      }
      url += '__list__'
      window.open(url, '_blank')
    })
  }

  addSection(title: string) {
    let section = document.createElement('div')
    section.className = 'auto-cms-menu--section'

    let titleNode = document.createElement('div')
    titleNode.className = 'auto-cms-menu--title'
    titleNode.textContent = title
    section.appendChild(titleNode)

    let ul = document.createElement('ul')
    ul.className = 'auto-cms-menu--list'
    section.appendChild(ul)

    this.appendChild(section)

    return ul
  }

  addMenuItem(
    ul: HTMLUListElement,
    text: string,
    onclick: (event: MouseEvent) => void,
  ) {
    let li = document.createElement('li')

    let button = document.createElement('button')
    button.textContent = text
    button.onclick = onclick

    li.appendChild(button)
    ul.appendChild(li)

    return { li, button }
  }

  disconnectedCallback() {
    this.flushTeardownFns()
    window.removeEventListener('click', this.handleWindowClick, {
      capture: true,
    })
  }

  handleWindowClick = (event: MouseEvent) => {
    let e = event.target
    if (e instanceof HTMLElement && !e.closest('auto-cms-menu')) {
      event.stopImmediatePropagation()
      event.preventDefault()
      this.remove()
    }
  }

  show(event: MouseEvent, target: HTMLElement) {
    AutoCMSMenu.instance?.remove()
    AutoCMSMenu.instance = this
    if (event.y < window.innerHeight / 2) {
      let top = `${event.y}px + 1rem`
      this.style.top = `calc(${top})`
      this.style.maxHeight = `calc(100dvh - (${top}))`
    } else {
      let bottom = `${window.innerHeight - event.y}px + 1rem`
      this.style.bottom = `calc(${bottom})`
      this.style.maxHeight = `calc(100dvh - (${bottom}))`
    }
    if (event.x < window.innerWidth / 2) {
      this.style.left = `calc(${event.x}px + 1rem)`
    } else {
      this.style.right = `calc(${window.innerWidth - event.x}px + 1rem)`
    }
    this.target = target
    document.body.appendChild(this)
  }
}

customElements.define('auto-cms-menu', AutoCMSMenu)

class AutoCMSStatus extends HTMLElement {
  connectedCallback() {
    this.innerHTML = /* html */ `
<style>
  auto-cms-status {
    position: fixed;
    top: 1rem;
    right: 1rem;
    border: 1px solid black;
    padding: 0.5rem;
    border-radius: 0.5rem;
    background-color: white;
    opacity: 0.8;
    z-index: ${getHighestZIndex() + 1};
  }
  auto-cms-status:hover {
    opacity: 0;
  }
  .auto-cms-status--text {
    user-select: none;
    color: black;
  }
</style>
<span class="auto-cms-status--text">auto-cms enabled</span>
`
  }
}

customElements.define('auto-cms-status', AutoCMSStatus)

setTimeout(() => {
  document.body.appendChild(new AutoCMSStatus())
})

// fix for preview mode when removing elements
{
  let style = document.createElement('style')
  style.setAttribute('auto-cms', '')
  style.innerHTML = /* css */ `
  [hidden] {
    display: none !important;
  }
  `
  document.body.appendChild(style)
}
