import Knex from 'knex'
import { dirname, join } from 'path'

let profile = require('../knexfile').development

export let knex = Knex(profile)

export async function setupKnex() {
  await knex.migrate.latest({
    directory: loadMigrationsPath(),
  })
}

function loadMigrationsPath() {
  let file = loadKnexPath()
  let dir = dirname(file)
  return join(dir, 'migrations')
}

function loadKnexPath() {
  try {
    // dev mode
    return require.resolve('../knexfile.ts')
  } catch (error) {
    // release mode
    return require.resolve('../knexfile.js')
  }
}
