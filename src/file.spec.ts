import { expect } from 'chai'
import { resolvePathname } from './file'
import { join, resolve } from 'path'

let site_dir = resolve('test-site')

describe('resolvePathname()', () => {
  it('should reject if the path is out of site directory', () => {
    var out = resolvePathname({ site_dir, pathname: '/../file' })
    expect(out).to.deep.equals({
      error: 'resolved pathname is out of the site directory',
    })
  })

  it('should reject if the pathname is .env files', () => {
    var out = resolvePathname({ site_dir, pathname: '/.env' })
    expect(out).to.deep.equals({
      error: 'resolved pathname is forbidden',
    })

    var out = resolvePathname({ site_dir, pathname: '/.env.docker' })
    expect(out).to.deep.equals({
      error: 'resolved pathname is forbidden',
    })

    var out = resolvePathname({ site_dir, pathname: '/docker.env' })
    expect(out).to.deep.equals({
      error: 'resolved pathname is forbidden',
    })
  })

  it('should preserve .html file', () => {
    var out = resolvePathname({ site_dir, pathname: '/file3.html' })
    expect(out).to.deep.equals({
      file: resolve(join(site_dir, 'file3.html')),
      exists: true,
    })

    out = resolvePathname({ site_dir, pathname: '/file2.html' })
    expect(out).to.deep.equals({
      file: resolve(join(site_dir, 'file2.html')),
      exists: false,
    })
  })

  it('should not add .html if file exists', () => {
    var out = resolvePathname({ site_dir, pathname: '/file2' })
    expect(out).to.deep.equals({
      file: resolve(join(site_dir, 'file2')),
      exists: true,
    })
  })

  it('should resolve to index.html inside if directory exists', () => {
    var out = resolvePathname({ site_dir, pathname: '/dir-with-index' })
    expect(out).to.deep.equals({
      file: resolve(join(site_dir, 'dir-with-index', 'index.html')),
      exists: true,
    })

    var out = resolvePathname({ site_dir, pathname: '/empty-dir' })
    expect(out).to.deep.equals({
      file: resolve(join(site_dir, 'empty-dir', 'index.html')),
      exists: false,
    })
  })

  it('should resolve to .html file if exists', () => {
    var out = resolvePathname({ site_dir, pathname: '/file3' })
    expect(out).to.deep.equals({
      file: resolve(join(site_dir, 'file3.html')),
      exists: true,
    })
  })

  it('should resolve to index.html inside directory if not exists', () => {
    var out = resolvePathname({ site_dir, pathname: '/not-exists' })
    expect(out).to.deep.equals({
      file: resolve(join(site_dir, 'not-exists', 'index.html')),
      exists: false,
    })
  })
})
