export type Expand<T> = T extends infer A ? { [K in keyof A]: A[K] } : never;
export type LastInArray<T extends unknown[]> = T extends [infer A] ? A : T extends [infer _, ...infer Rest] ? LastInArray<Rest> : never;
export type Class<T, Args extends unknown[] = unknown[], I extends NonNullable<object> = NonNullable<object>> = {
    new(...args: Args): T,
    [Symbol.hasInstance](value: unknown): boolean,
} & I;