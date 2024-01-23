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

function ask<E extends HTMLElement>(
  message: string,
  e: E,
  key: keyof E & string,
) {
  if (e.hasAttribute(key)) {
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
  console.log({ lines })
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

class AutoCMSMenu extends HTMLElement {
  static instance?: AutoCMSMenu

  target?: HTMLElement

  constructor() {
    super()
  }

  connectedCallback() {
    const target = this.target
    if (!target) return
    window.addEventListener('click', this.handleWindowClick, {
      capture: true,
      passive: false,
    })
    this.innerHTML = /* html */ `
<style>
  auto-cms-menu {
    position: fixed;
    border: 1px solid black;
    border-radius: 0.25rem;
    background-color: white;
    overflow: hidden;
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
</style>
`

    let updateSection = this.addSection('Update')
    if (target.children.length == 0 && target.innerText) {
      this.addMenuItem(updateSection, 'Text', event => {
        ask('text content', target, 'innerText')
      })
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
    this.addMenuItem(copySection, 'Select Element', event => {
      alert(
        'right click > inspect > right-click element > click "Edit As HTML" > copy and paste',
      )
    })

    let removeSection = this.addSection('Remove')
    this.addMenuItem(removeSection, 'Select Element', event => {
      alert('right click > inspect > right-click element > click "Delete Node"')
    })

    let cmsSection = this.addSection('CMS')
    this.addMenuItem(cmsSection, 'Save', event => {
      let button = event.target as HTMLButtonElement
      button.textContent = 'Saving'
      fetch('/auto-cms/save', {
        method: 'POST',
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
    this.addMenuItem(cmsSection, 'Publish', event => {
      alert('TODO')
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
  }

  disconnectedCallback() {
    window.removeEventListener('click', this.handleWindowClick, {
      capture: true,
    })
  }

  handleWindowClick = (event: MouseEvent) => {
    let e = event.target
    if (e instanceof HTMLElement && !e.closest('auto-cms-menu')) {
      this.remove()
      event.stopImmediatePropagation()
      event.preventDefault()
      window.removeEventListener('click', this.handleWindowClick, {
        capture: true,
      })
    }
  }

  show(event: MouseEvent, target: HTMLElement) {
    AutoCMSMenu.instance?.remove()
    AutoCMSMenu.instance = this
    this.style.top = event.y + 'px'
    this.style.left = event.x + 'px'
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
  }
  auto-cms-status:hover {
    opacity: 0;
  }
  .auto-cms-status--text {
    user-select: none;
  }
</style>
<span class="auto-cms-status--text">auto-cms enabled</span>
`
  }
}

customElements.define('auto-cms-status', AutoCMSStatus)

document.body.appendChild(new AutoCMSStatus())
