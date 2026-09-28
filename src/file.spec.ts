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
      type: 'file',
    })

    out = resolvePathname({ site_dir, pathname: '/file2.html' })
    expect(out).to.deep.equals({
      file: resolve(join(site_dir, 'file2.html')),
      exists: false,
      type: 'file',
    })
  })

  it('should not add .html if file exists', () => {
    var out = resolvePathname({ site_dir, pathname: '/file2' })
    expect(out).to.deep.equals({
      file: resolve(join(site_dir, 'file2')),
      exists: true,
      type: 'file',
    })
  })

  it('should resolve to index.html inside if directory exists', () => {
    var out = resolvePathname({ site_dir, pathname: '/dir-with-index' })
    expect(out).to.deep.equals({
      file: resolve(join(site_dir, 'dir-with-index', 'index.html')),
      exists: true,
      type: 'dir',
    })

    var out = resolvePathname({ site_dir, pathname: '/empty-dir' })
    expect(out).to.deep.equals({
      file: resolve(join(site_dir, 'empty-dir', 'index.html')),
      exists: false,
      type: 'dir',
    })
  })

  it('should mark directory pages so that the caller can redirect to trailing slash', () => {
    var out = resolvePathname({ site_dir, pathname: '/dir-with-index' })
    expect(out).to.have.property('type', 'dir')

    var out = resolvePathname({ site_dir, pathname: '/file3' })
    expect(out).to.have.property('type', 'file')
  })

  it('should resolve to .html file if exists', () => {
    var out = resolvePathname({ site_dir, pathname: '/file3' })
    expect(out).to.deep.equals({
      file: resolve(join(site_dir, 'file3.html')),
      exists: true,
      type: 'file',
    })
  })

  it('should resolve to index.html inside directory if not exists', () => {
    var out = resolvePathname({ site_dir, pathname: '/not-exists' })
    expect(out).to.deep.equals({
      file: resolve(join(site_dir, 'not-exists', 'index.html')),
      exists: false,
      type: 'dir',
    })
  })
})
