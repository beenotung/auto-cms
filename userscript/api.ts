export async function fetch_json<T>(url: string, init: RequestInit) {
  return fetch(url, init)
    .then(res => res.json().catch(err => ({ error: res.statusText })))
    .then(json => {
      if (json.error) {
        throw json.error
      }
      return json as T
    })
}

export async function resolveFilePathname(pathname: string) {
  let json = await fetch_json<{ pathname: string; exists: string }>(
    '/auto-cms/file',
    {
      method: 'OPTIONS',
      headers: {
        'X-Pathname': encodeURIComponent(pathname),
      },
    },
  )
  return json
}
