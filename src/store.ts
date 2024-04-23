import { Request } from 'express'
import { DBProxy, createProxy } from './proxy'
import { object, optional, string } from 'cast.ts'
import { db } from './db'

let _proxy: DBProxy | undefined

function getProxy() {
  if (!_proxy) {
    _proxy = createProxy({ db })
  }
  return _proxy
}

export function storeRequest(req: Request) {
  let proxy = getProxy()
  let id = proxy.request.push({
    method: req.method,
    url: req.url,
    user_agent: req.headers['user-agent'] || null,
    request_time: Date.now(),
  })
  return { id }
}

let contactParser = object({
  name: optional(string()),
  email: optional(string()),
  tel: optional(string()),
  company_name: optional(string()),
  business_nature: optional(string()),
  remark: optional(string()),
})

export function storeContact(req: Request) {
  let proxy = getProxy()
  let input = contactParser.parse(req.body, { name: 'req.body' })
  let id = proxy.contact.push({
    name: input.name || null,
    email: input.email || null,
    tel: input.tel || null,
    company_name: input.company_name || null,
    business_nature: input.business_nature || null,
    remark: input.remark || null,
    submit_time: Date.now(),
    confirm_time: null,
    dismiss_time: null,
    mailchimp_sync_time: null,
  })
  return { id }
}
