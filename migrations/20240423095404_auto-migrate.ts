import { Knex } from 'knex'

// prettier-ignore
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('request'))) {
    await knex.schema.createTable('request', table => {
      table.increments('id')
      table.text('method').notNullable()
      table.text('url').notNullable()
      table.text('user_agent').nullable()
      table.integer('request_time').notNullable()
      table.timestamps(false, true)
    })
  }

  if (!(await knex.schema.hasTable('contact'))) {
    await knex.schema.createTable('contact', table => {
      table.increments('id')
      table.text('name').nullable()
      table.text('email').nullable()
      table.text('tel').nullable()
      table.text('company_name').nullable()
      table.text('business_nature').nullable()
      table.text('remark').nullable()
      table.integer('submit_time').notNullable()
      table.integer('confirm_time').nullable()
      table.integer('dismiss_time').nullable()
      table.integer('mailchimp_sync_time').nullable()
      table.timestamps(false, true)
    })
  }
}

// prettier-ignore
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('contact')
  await knex.schema.dropTableIfExists('request')
}
