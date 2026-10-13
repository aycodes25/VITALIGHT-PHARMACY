// A database that has not applied the newer migrations answers with an undefined-column
// error: Postgres 42703, or PostgREST PGRST204 (column not in the schema cache).
export const isMissingColumn = (error) => error?.code === '42703'
  || error?.code === 'PGRST204'
  || /column .* does not exist|could not find the .* column/i.test(error?.message ?? '')
