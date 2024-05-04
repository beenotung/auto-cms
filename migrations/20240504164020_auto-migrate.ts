import { Knex } from 'knex'

// prettier-ignore
export async function up(knex: Knex): Promise<void> {
  await knex.raw('alter table `request` add column `lang` text null')
  await knex.raw('alter table `request` add column `is_admin` boolean null')
}

// prettier-ignore
export async function down(knex: Knex): Promise<void> {
  await knex.raw('alter table `request` drop column `is_admin`')
  await knex.raw('alter table `request` drop column `lang`')
}
