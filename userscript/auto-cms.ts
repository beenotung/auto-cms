export let version = '0.1.13'

let win = window as any

export function edit() {
  muteAllEventListeners()
  window.addEventListener('click', onEvent)
}

export function disable() {
  window.removeEventListener('click', onEvent)
}

function onEvent(event: Event) {
  if (win.auto_cms.version != version) {
    disable()
    return
  }
  let e = event.target
  console.log('target:', e)
  if (e instanceof HTMLAnchorElement) {
    stopEvent(event)
    ask('hyperlink', e, 'href')
  }
  if (e instanceof HTMLImageElement) {
    stopEvent(event)
    ask('image link', e, 'src')
    e.removeAttribute('srcset')
  }
  if (e instanceof HTMLElement && e.children.length == 0 && e.innerText) {
    stopEvent(event)
    ask('text content', e, 'innerText')
  }
  if (e instanceof HTMLElement && !(e instanceof HTMLAnchorElement)) {
    let a = e.closest('a')
    if (a) {
      ask('hyperlink', a, 'href')
    }
  }
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

function stopEvent(event: Event) {
  event.stopImmediatePropagation()
  event.preventDefault()
}

function muteAllEventListeners() {
  document.body.innerHTML += ''
}

class AutoCMS extends HTMLElement {
  connectedCallback() {
    this.innerHTML = /* html */ `
<style>
  auto-cms {
    position: fixed;
    top: 1rem;
    right: 1rem;
    border: 1px solid black;
    padding: 0.5rem;
    border-radius: 0.5rem;
    background-color: white;
    opacity: 0.8;
  }
  auto-cms:hover {
    opacity: 0;
  }
  auto-cms span {
    user-select: none;
  }
</style>
<span>auto-cms enabled</span>
`
  }
}

customElements.define('auto-cms', AutoCMS)

document.body.appendChild(document.createElement('auto-cms'))
