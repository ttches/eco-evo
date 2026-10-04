/** Vocabulary shared by every analysis module. */

export type TypeName = 'prey' | 'hunter'

export const TYPE_NAMES: readonly TypeName[] = ['prey', 'hunter']

/** Build a `{ prey, hunter }` record by calling `make` once per type. */
export const perType = <T>(
  make: (type: TypeName) => T,
): Record<TypeName, T> => ({
  prey: make('prey'),
  hunter: make('hunter'),
})

export type TypeCounts = Record<TypeName, number> & { total: number }
