declare var pathnameNode: HTMLElement
declare var errorNode: HTMLElement

async function init() {
  try {
    const params = new URLSearchParams(window.location.search)
    const pathname = params.get('pathname')
    if (!pathname) {
      throw 'missing pathname in location.search'
    }
    pathnameNode.textContent = pathname
  } catch (error) {
    errorNode.textContent = String(error)
  }
}

init()
