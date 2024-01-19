let version = '0.1.7'

let win = window as any

export function inject() {
  win.version = version
  muteAllEventListeners()
  window.addEventListener('click', onEvent)
  function onEvent(event: Event) {
    if (win.version != version) {
      window.removeEventListener('click', onEvent)
      return
    }
    let e = event.target
    if (e instanceof HTMLAnchorElement) {
      stopEvent(event)
      ask('hyperlink', e, 'href')
    }
    if (e instanceof HTMLImageElement) {
      stopEvent(event)
      ask('image link', e, 'src')
    }
    if (e instanceof HTMLElement && e.innerText) {
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
}

function ask<T>(message: string, object: T, key: keyof T) {
  let o = object as any
  let ans = prompt(message, o[key])
  if (ans) {
    o[key] = ans
  }
}

function stopEvent(event: Event) {
  event.stopImmediatePropagation()
  event.preventDefault()
}

function muteAllEventListeners() {
  document.body.innerHTML += ''
}

inject()
