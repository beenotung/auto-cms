export let version = '0.1.16'

let win = window as any
win.auto_cms = { version }

window.addEventListener('contextmenu', onContextMenu, {
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

function ask<E extends Node>(message: string, e: E, key: keyof E & string) {
  if (e instanceof Element && e.hasAttribute(key)) {
    let ans = prompt(message, e.getAttribute(key) as string)
    if (ans) {
      e.setAttribute(key, ans)
    }
  } else {
    let ans = prompt(message, e[key] as string)
    if (ans) {
      ;(e as any)[key] = ans
    }
  }
}

function exportHTML() {
  let doc = new DOMParser().parseFromString(
    document.body.parentElement!.outerHTML,
    'text/html',
  )

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
      break
    }
  }

  // remove Video Speed Controller
  if (doc.body.classList.contains('vsc-initialized')) {
    doc.body.classList.remove('vsc-initialized')
    if (doc.body.classList.length == 0) {
      doc.body.removeAttribute('class')
    }
  }

  // remove auto-cms
  doc.querySelector('script[src="/auto-cms.js"]')?.remove()
  doc.querySelector('auto-cms-status')?.remove()
  doc.querySelector('auto-cms-menu')?.remove()
  doc.querySelector('style[auto-cms]')?.remove()

  // trim body
  let lines = doc.body.innerHTML.split('\n')
  for (; lines.length > 0; ) {
    let line = lines.pop()!
    if (line == '') continue
    if (line.trim() == '') {
      break
    } else {
      lines.push(line)
      break
    }
  }
  doc.body.innerHTML = lines.join('\n')

  let html = doc.body.parentElement!.outerHTML

  // fix body newline
  let bodyIndentation = html.match(/( +)<body/)?.[1] || ''
  html = html.replace('</body>', '\n' + bodyIndentation + '</body>\n')

  // fix head newline
  let headIndentation =
    doc.head.innerHTML.split('\n').pop()!.match(/^( +)/)?.[1] || ''
  html = html.replace('<head', '\n' + headIndentation + '<head')

  // fix doctype
  html = '<!DOCTYPE html>\n' + html

  // fix self-closing tags
  html = html.replace(/(<link .*?)>/g, (_, match) => match + ' />')
  html = html.replace(/(<meta .*?)>/g, (_, match) => match + ' />')

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

class AutoCMSMenu extends HTMLElement {
  static instance?: AutoCMSMenu

  shadowRoot: ShadowRoot

  target?: HTMLElement

  confirmRemoveItem?: Function

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
      if (node.nodeType === Node.TEXT_NODE && node.nodeValue?.trim()) {
        console.log(node)
        this.addMenuItem(updateSection, 'Text: ' + node.nodeValue, event => {
          ask('text content', node, 'nodeValue')
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
      let src = target.src
      let srcset = target.getAttribute('srcset')
      if (src || srcset) {
        this.addMenuItem(updateSection, 'Image', event => {
          if (src) {
            ask('image link', target, 'src')
          }
          if (srcset) {
            ask('image link', target, 'srcset')
          }
        })
      }
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
        let { button } = this.addMenuItem(removeSection, targetText, event => {
          if (!target.hidden) {
            target.hidden = true
            this.confirmRemoveItem = () => {
              target.remove()
              button.remove()
            }
            button.textContent = 'Undo'
          } else {
            target.hidden = false
            this.confirmRemoveItem = undefined
            button.textContent = targetText
          }
        })
        button.style.textAlign = 'start'
        if (target.parentElement) {
          addTarget(target.parentElement, index + 1)
        }
      }
      addTarget(target, 1)
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
    this.addMenuItem(cmsSection, 'Save', event => {
      this.confirmRemoveItem?.()
      let button = event.target as HTMLButtonElement
      button.textContent = 'Saving'
      fetch('/auto-cms/file', {
        method: 'PUT',
        headers: {
          'Content-Type': 'text/html',
          'X-Pathname': location.pathname,
        },
        body: exportHTML(),
      })
        .then(res => res.json())
        .then(json => {
          if (json.error) {
            throw json.error
          } else {
            button.textContent = 'Saved'
          }
        })
        .catch(error => {
          alert(String(error))
          button.textContent = 'Save'
        })
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
    this.confirmRemoveItem?.()
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
