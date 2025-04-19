import { Request } from 'express'
import { Contact, DBProxy, createProxy } from './proxy'
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
    lang: req.cookies.LANG || null,
    is_admin: req.session.auto_cms_enabled || false,
  })
  return { id }
}

export function storeContact(req: Request) {
  let proxy = getProxy()
  let { name, email, tel, company_name, business_nature, remark, ...extra } =
    req.body || {}
  let contact: Contact = {
    name: name || null,
    email: email || null,
    tel: tel || null,
    company_name: company_name || null,
    business_nature: business_nature || null,
    lang: req.cookies.lang || null,
    remark: remark || null,
    extra: Object.keys(extra).length == 0 ? null : JSON.stringify(extra),
    submit_time: Date.now(),
    confirm_time: null,
    dismiss_time: null,
    mailchimp_sync_time: null,
  }
  let id = proxy.contact.push(contact)
  contact.id = id
  return contact
}
