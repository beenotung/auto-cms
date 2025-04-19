import { proxySchema, ProxySchemaOptions } from 'better-sqlite3-proxy'

export type Request = {
  id?: null | number
  method: string
  url: string
  user_agent: null | string
  request_time: number
  lang: null | string
  is_admin: null | boolean
}

export type Contact = {
  id?: null | number
  name: null | string
  email: null | string
  tel: null | string
  company_name: null | string
  business_nature: null | string
  remark: null | string
  lang: null | string
  extra: null | string
  submit_time: number
  confirm_time: null | number
  dismiss_time: null | number
  mailchimp_sync_time: null | number
}

export type DBProxy = {
  request: Request[]
  contact: Contact[]
}

export let tableFields: ProxySchemaOptions<DBProxy>['tableFields'] = {
    request: [],
    contact: [],
}

export function createProxy(
  options: Omit<ProxySchemaOptions<DBProxy>, 'tableFields'>,
) {
  return proxySchema<DBProxy>({
    tableFields,
    ...options,
  })
}
