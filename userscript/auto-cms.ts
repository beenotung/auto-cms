import { fetch_json, resolveFilePathname } from './api'
import { wrapText } from './i18n'
import { extractPadding } from './string'

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
  if (!(target instanceof HTMLElement) && !(target instanceof SVGElement)) {
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

function toTagText(target: HTMLElement | SVGElement): string {
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

function addBootstrap() {
  addBootstrapCSS()
  addBootstrapJS()
}

function addBootstrapCSS() {
  let links = document.querySelectorAll<HTMLLinkElement>(
    'link[rel="stylesheet"]',
  )
  for (let link of links) {
    if (link.href.includes('bootstrap')) {
      return
    }
  }
  let link = document.createElement('link')
  link.setAttribute(
    'href',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css',
  )
  link.setAttribute('rel', 'stylesheet')
  link.setAttribute(
    'integrity',
    'sha384-rbsA2VBKQhggwzxH7pPCaAqO46MgnOM80zW1RWuH61DGLwZJEdK2Kadq2F9CUG65',
  )
  link.setAttribute('crossorigin', 'anonymous')
  appendToHead(link)
}

function addBootstrapJS() {
  let scripts = document.querySelectorAll<HTMLScriptElement>('script[src]')
  for (let script of scripts) {
    if (script.src.includes('bootstrap')) {
      return
    }
  }
  let script = document.createElement('script')
  script.setAttribute(
    'src',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/js/bootstrap.bundle.min.js',
  )
  script.setAttribute(
    'integrity',
    'sha384-kenU1KFdBIe4zVF0s0G1M5b4hcpxyD9F7jL+jjXkk+Q2h455rYXK/7HAuoJl+0I4',
  )
  script.setAttribute('crossorigin', 'anonymous')
  document.body.appendChild(script)
}

class AutoCMSMenu extends HTMLElement {
  static instance?: AutoCMSMenu

  shadowRoot: ShadowRoot

  target?: HTMLElement | SVGElement

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
      let addTarget = (target: HTMLElement | SVGElement, index: number) => {
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
      let addTarget = (target: HTMLElement | SVGElement, index: number) => {
        if (target == document.body) return
        let targetText = `${index}: ${toTagText(target)}`
        let remove = this.wrapTeardownFn(() => {
          target.remove()
          button.remove()
        })
        let { button } = this.addMenuItem(removeSection, targetText, event => {
          if (!target.hasAttribute('hidden')) {
            target.setAttribute('hidden', '')
            button.textContent = 'Undo'
          } else {
            target.removeAttribute('hidden')
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

    let hideSection = this.addSection('Hide')
    this.addMenuItem(hideSection, 'Advanced Mode', event => {
      alert(
        'right click > inspect > left-click element > edit style > set "display: none"',
      )
    })
    this.addMenuItem(hideSection, 'Easy Mode', event => {
      let addTarget = (target: HTMLElement | SVGElement, index: number) => {
        if (target == document.body) return
        let targetText = `${index}: ${toTagText(target)}`
        let { button } = this.addMenuItem(hideSection, targetText, event => {
          if (!target.hasAttribute('hidden')) {
            target.setAttribute('hidden', '')
            button.textContent = 'Undo'
          } else {
            target.removeAttribute('hidden')
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

    let removeChildrenSection = this.addSection('Remove Children')
    this.addMenuItem(removeChildrenSection, 'Advanced Mode', event => {
      alert('right click > inspect > run "$0.textContent = \'\'"')
    })
    this.addMenuItem(removeChildrenSection, 'Easy Mode', event => {
      let addTarget = (target: HTMLElement | SVGElement, index: number) => {
        if (target == document.body) return
        let targetText = `${index}: ${toTagText(target)}`
        let innerHTML = target.innerHTML
        let remove = this.wrapTeardownFn(() => {
          target.innerHTML = ''
          button.remove()
        })
        let { button } = this.addMenuItem(
          removeChildrenSection,
          targetText,
          event => {
            if (!target.hasAttribute('hidden')) {
              target.textContent = ''
              button.textContent = 'Undo'
            } else {
              target.innerHTML = innerHTML
              button.textContent = targetText
            }
            remove.toggle()
          },
        )
        button.style.textAlign = 'start'
        if (target.parentElement) {
          addTarget(target.parentElement, index + 1)
        }
      }
      addTarget(target, 1)
    })

    let i18nSection = this.addSection('i18n')
    this.addMenuItem(i18nSection, 'Extract Text', event => {
      let span = document.createElement('span')
      document.body.appendChild(span)
      let extractText = (node: Node) => {
        // wrap text node with {{ }}
        if (node.nodeType === Node.TEXT_NODE) {
          let fullText = node.nodeValue
          if (!fullText) return

          span.textContent = fullText
          let trimmedText = span.innerText.trim()
          if (!trimmedText.trim()) return

          if (trimmedText.includes('{[') && trimmedText.includes(']}')) return
          if (trimmedText.includes('{{') && trimmedText.includes('}}')) return

          let padding = extractPadding(fullText, trimmedText)
          let text = padding.leading + trimmedText + padding.tailing

          let wrappedText = wrapText(text)
          if (wrappedText) {
            node.nodeValue = wrappedText
          }

          return
        }

        // exclude script, style, noscript, and auto-cms elements
        if (
          node instanceof HTMLScriptElement ||
          node instanceof SVGScriptElement ||
          node instanceof HTMLStyleElement ||
          node instanceof SVGStyleElement ||
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
      span.remove()
    })
    this.addMenuItem(i18nSection, 'Edit Translations', event => {
      let params = new URLSearchParams({ pathname: location.pathname })
      let url = `/auto-cms/multi-lang?${params}`
      window.open(url, '_blank')
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

    let miscSection = this.addSection('Misc')
    this.addMenuItem(miscSection, 'Favicon', async event => {
      let nodes = Array.from(
        document.querySelectorAll(
          'link[rel="icon"],link[rel="shortcut icon"],link[rel="mask-icon"]',
        ),
      )
      if (nodes.length == 0) {
        let link = document.createElement('link')
        link.setAttribute('rel', 'icon')
        link.setAttribute('href', '/favicon.ico')
        nodes.push(link)
        document.head.appendChild(link)
      }
      let link = nodes[0]
      let href = link.getAttribute('href') || undefined
      if (href && href[0] != '/') {
        href = '/' + href
      }
      let ans = prompt('Image for favicon (recommended 32x32px):', href)
      if (ans == null) return
      if (ans == '') {
        link.remove()
      } else {
        link.setAttribute('href', ans)
      }
      for (let i = 1; i < nodes.length; i++) {
        nodes[i].remove()
      }
    })
    this.addMenuItem(miscSection, 'PWA Icon', async event => {
      let nodes = Array.from(
        document.querySelectorAll('link[rel="apple-touch-icon"]'),
      )
      if (nodes.length == 0) {
        let link = document.createElement('link')
        link.setAttribute('rel', 'apple-touch-icon')
        nodes.push(link)
        document.head.appendChild(link)
      }
      let link = nodes[0]
      let href = link.getAttribute('href') || undefined
      if (href && href[0] != '/') {
        href = '/' + href
      }
      let ans = prompt('Image for PWA icon (recommended 180x180px):', href)
      if (ans == null) return
      if (ans == '') {
        link.remove()
      } else {
        link.setAttribute('href', ans)
      }
      for (let i = 1; i < nodes.length; i++) {
        nodes[i].remove()
      }
    })
    this.addMenuItem(miscSection, 'Add Navbar', event => {
      let header = document.body.querySelector('header')
      if (!header) {
        header = document.createElement('header')
        document.body.prepend(header)
      }
      addBootstrap()
      let nav = document.createElement('nav')
      header.prepend(nav)
      nav.outerHTML = /* html */ `
<nav class="navbar navbar-expand-lg bg-light">
  <div class="container-fluid">
    <a class="navbar-brand" href="#">Navbar</a>
    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
      <span class="navbar-toggler-icon"></span>
    </button>
    <div class="collapse navbar-collapse" id="navbarSupportedContent">
      <ul class="navbar-nav me-auto mb-2 mb-lg-0">
        <li class="nav-item">
          <a class="nav-link active" aria-current="page" href="#">Home</a>
        </li>
        <li class="nav-item">
          <a class="nav-link" href="#">Link</a>
        </li>
        <li class="nav-item dropdown">
          <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">
            Dropdown
          </a>
          <ul class="dropdown-menu">
            <li><a class="dropdown-item" href="#">Action</a></li>
            <li><a class="dropdown-item" href="#">Another action</a></li>
            <li><hr class="dropdown-divider"></li>
            <li><a class="dropdown-item" href="#">Something else here</a></li>
          </ul>
        </li>
        <li class="nav-item">
          <a class="nav-link disabled">Disabled</a>
        </li>
      </ul>
      <form class="d-flex" role="search">
        <input class="form-control me-2" type="search" placeholder="Search" aria-label="Search">
        <button class="btn btn-outline-success" type="submit">Search</button>
      </form>
    </div>
  </div>
</nav>
`
    })
    this.addMenuItem(miscSection, 'Deduplicate Selector', async event => {
      let button = event.target as HTMLButtonElement
      let selector = prompt('selector: ')
      if (!selector) return
      let nodes = Array.from(document.querySelectorAll(selector)).slice(1)
      for (let node of nodes) {
        node.remove()
      }
      button.textContent = `Cleanup ${nodes.length} elements`
    })
    this.addMenuItem(miscSection, 'Deduplicate Scripts', async event => {
      let button = event.target as HTMLButtonElement
      let n = 0
      let set = new Set<string>()
      function check<T extends HTMLElement>(
        selector: string,
        extractFn: (node: T) => string | null,
      ) {
        let nodes = document.querySelectorAll<T>(selector)
        for (let node of nodes) {
          let str = extractFn(node)
          if (!str) {
            continue
          }
          if (!set.has(str)) {
            set.add(str)
            continue
          }
          node.remove()
          n++
        }
      }
      check<HTMLScriptElement>('script', node => node.src || node.textContent)
      check<HTMLStyleElement>('style', node => node.textContent)
      check<HTMLLinkElement>('link[rel="stylesheet"][href]', node => node.href)
      check<HTMLLinkElement>(
        'link[rel="stylesheet"]:not([href])[id]',
        node => node.id,
      )
      check<HTMLLinkElement>('link[rel="preconnect"][href]', node => node.href)
      check<HTMLLinkElement>(
        'link[rel="dns-prefetch"][href]',
        node => node.href,
      )
      check<HTMLMetaElement>(
        'meta[http-equiv="origin-trial"]',
        node => node.content,
      )
      let selectors = [
        '.wistia_injected_style',
        'iframe[owner="archetype"][title="archetype"]',
      ]
      for (let selector of selectors) {
        for (let node of document.querySelectorAll(selector)) {
          node.remove()
          n++
        }
      }
      button.textContent = `Deduplicated ${n} scripts`
    })
    this.addMenuItem(miscSection, 'Deduplicate Class', async event => {
      let button = event.target as HTMLButtonElement
      let n = 0
      let nodes = document.querySelectorAll('[class]')
      for (let node of nodes) {
        let className = Array.from(node.classList).join(' ')
        if (node.getAttribute('class') != className) {
          // set "class" attribute instead of "className" property because that is readonly in SVGElement
          node.setAttribute('class', className)
          n++
        }
      }
      button.textContent = `Cleanup ${n} elements`
    })
    this.addMenuItem(miscSection, 'Remove Invisible IFrames', async event => {
      let button = event.target as HTMLButtonElement
      let n = 0
      let selectors = ['iframe[width="0"]', 'iframe[height="0"]']
      for (let selector of selectors) {
        let nodes = document.querySelectorAll(selector)
        for (let node of nodes) {
          node.remove()
          n++
        }
      }
      for (let node of document.querySelectorAll('iframe')) {
        if (node.style.opacity == '0') {
          node.remove()
          n++
        }
      }
      for (let node of document.querySelectorAll('noscript')) {
        if (
          /<img(.|\n)*src="https:\/\/www\.facebook\.com\/tr\?/.test(
            node.innerText,
          )
        ) {
          // facebook tracking pixel
          node.remove()
          n++
        }
      }
      button.textContent = `Removed ${n} scripts`
    })
    this.addMenuItem(miscSection, 'Remove Tracking Scripts', async event => {
      let button = event.target as HTMLButtonElement
      let n = 0
      let selectors = [
        'script[src*="://www.googleadservices.com/pagead/conversion/"]',
        'script[src*="://googleads.g.doubleclick.net/"]',
        'script[src*="://static.doubleclick.net/"]',
        'iframe[src*="://td.doubleclick.net/"]',
        'script[src*="://www.googletagmanager.com/gtag/"]',
        'script[src*="://connect.facebook.net/signals/config/"]',
        'script[src*="://connect.facebook.net/en_US/fbevents.js"]',
        'script[src*="://js.callrail.com/"]',
        'script[src*="//cdn.callrail.com/"]',
        'script[src*="://utt.impactcdn.com/"]',
        'script[src*="://browser.sentry-cdn.com/"]',
        'script[src*="://js.sentry-cdn.com/"]',
        'script[src*="://scripts.kissmetrics.io/"]',
        'script[src*="://www.clickcease.com/"]',
        'script[src*="://cdn.mida.so/js/"]',
      ]
      for (let selector of selectors) {
        let nodes = document.querySelectorAll(selector)
        for (let node of nodes) {
          node.remove()
          n++
        }
      }

      let keywords = [
        // facebook tracking pixel
        'https://www.facebook.com/tr?',
        'https://connect.facebook.net/en_US/fbevents.js"',
        // google tag manager
        'https://www.googletagmanager.com/gtm.js',
        "gtag('js', new Date())",
        "gtag('config', '",
        'https://utt.impactcdn.com/',
        'https://monitor.clickcease.com',
        'https://www.clickcease.com/monitor/stat.js',
        'https://cdn.mida.so/js/optimize.js?',
        '//scripts.kissmetrics.io/',
      ]
      for (let node of document.querySelectorAll<HTMLElement>(
        'script,noscript',
      )) {
        let text = node.textContent
        if (!text) continue
        for (let keyword of keywords) {
          if (text.includes(keyword)) {
            node.remove()
            n++
            break
          }
        }
      }
      button.textContent = `Removed ${n} scripts`
    })
    this.addMenuItem(miscSection, 'Rearrange head & body', async event => {
      let button = event.target as HTMLButtonElement
      let n = 0
      let selectors = ['body title', 'body meta', 'body link']
      for (let selector of selectors) {
        for (let node of document.querySelectorAll(selector)) {
          document.head.appendChild(node)
          n++
        }
      }
      button.textContent = `Rearranged ${n} elements`
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
      let pathname = prompt(
        'Pathname:',
        location.pathname.replaceAll(/_bk[0-9T]{15}/g, ''),
      )
      if (!pathname) return
      let path = await resolveFilePathname(pathname)
      pathname = path.pathname
      if (path.exists) {
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
            'X-To-Pathname': encodeURIComponent(pathname),
          },
        })
        button.textContent = 'Saved'
        let ans = confirm(`Open ${pathname} ?`)
        if (ans) {
          window.open(location.origin + pathname, '_blank')
        }
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

  show(event: MouseEvent, target: HTMLElement | SVGElement) {
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
