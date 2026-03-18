---
name: typescript-best-practices
description: TypeScript development best practices including type system, generics, utility types, configuration, and patterns for React, Node.js, and full-stack applications
user-invocable: true
---

# TypeScript Best Practices

## Type Fundamentals

### Primitives

Use lowercase types. Never use boxed types (`Number`, `String`, `Boolean`, `Object`).

```ts
// Do
const name: string = 'John';
const age: number = 30;
const active: boolean = true;
const id: symbol = Symbol('id');
const obj: object = {};

// Don't
const name: String = 'John';   // Boxed type — almost never correct
const age: Number = 30;
```

### Arrays & Tuples

```ts
const numbers: number[] = [1, 2, 3];
const mixed: (string | number)[] = [1, 'two', 3];

// Tuples — fixed-length, typed positions
const tuple: [string, number] = ['hello', 42];
const namedTuple: [name: string, age: number] = ['John', 30];
```

### Objects

```ts
const user: { name: string; age: number } = { name: 'John', age: 30 };
```

### `any` vs `unknown`

Prefer `unknown` over `any`. `any` disables all type checking — treat it like `@ts-ignore` on every usage. `unknown` requires narrowing before use.

```ts
const dangerous: any = getData();      // No type checking — avoid
const safe: unknown = getData();        // Requires narrowing — prefer

if (typeof safe === 'string') {
    console.log(safe.toUpperCase());    // TS knows it's string
}
```

## Interfaces vs Types

Use **interface** for object shapes (extendable via `extends` and declaration merging). Use **type** for unions, intersections, primitives, and computed types.

```ts
// Interface — extendable, for objects
interface User {
    id: number;
    name: string;
    email: string;
}

interface AdminUser extends User {
    role: 'admin';
    permissions: string[];
}

// Type — unions, primitives, computed
type ID = string | number;
type Callback = (data: string) => void;
type Status = 'pending' | 'active' | 'inactive';

// Intersection
type UserWithTimestamps = User & {
    createdAt: Date;
    updatedAt: Date;
};
```

## Optional & Readonly Properties

```ts
interface Config {
    required: string;
    optional?: string;
    readonly immutable: string;
}
```

### Don't Mix `?` with `| null`

Combining optional (`?`) and nullable (`| null`) creates three absence states — `undefined`, `null`, and missing — forcing consumers to check for both. Pick one representation for "no value."

```ts
// Don't — three states for "no error"
interface Result {
    error?: string | null;  // undefined, null, or string
}

// Do — pick one
interface Result {
    error?: string;         // optional: absence = undefined
}
// or
interface Result {
    error: string | null;   // required but nullable: absence = null
}
```

**When `?` + `| null` is justified:** Partial update APIs and ORM types (e.g., Prisma) where `undefined` means "don't touch this field" and `null` means "clear it." JSON serialization also distinguishes them — `undefined` properties are stripped, `null` survives. Outside these boundaries, it's accidental complexity.

## Utility Types

```ts
type ReadonlyUser = Readonly<User>;           // All props readonly
type PartialUser = Partial<User>;             // All props optional
type RequiredUser = Required<User>;           // All props required

type UserPreview = Pick<User, 'id' | 'name'>;
type UserWithoutEmail = Omit<User, 'email'>;
type UserRoles = Record<string, 'admin' | 'user' | 'guest'>;

type ActiveStatus = Extract<Status, 'pending' | 'active'>;
type WithoutDeleted = Exclude<Status, 'deleted'>;

type CreateUserReturn = ReturnType<typeof createUser>;
type CreateUserParams = Parameters<typeof createUser>;
type DefinitelyString = NonNullable<string | null | undefined>;  // string
```

## Generics

### Basic

```ts
function identity<T>(value: T): T {
    return value;
}

interface Response<T> {
    data: T;
    status: number;
    message: string;
}

class Queue<T> {
    private items: T[] = [];
    enqueue(item: T): void { this.items.push(item); }
    dequeue(): T | undefined { return this.items.shift(); }
}
```

### Constraints

```ts
interface HasId { id: number; }

function findById<T extends HasId>(items: T[], id: number): T | undefined {
    return items.find(item => item.id === id);
}
```

### `keyof` Constraint

```ts
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
    return obj[key];
}
```

### Generic Gotcha

Don't define generic type parameters that aren't used — it breaks type inference.

## Type Guards

### Built-in Narrowing

```ts
// typeof
if (typeof value === 'string') { /* string here */ }

// instanceof
if (error instanceof TypeError) { /* TypeError here */ }

// in
if ('code' in error) { /* has 'code' property */ }
```

### Custom Type Guards

```ts
function isApiError(error: unknown): error is ApiError {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        'message' in error
    );
}
```

## Advanced Patterns

### Discriminated Unions

```ts
interface LoadingState { status: 'loading'; }
interface SuccessState<T> { status: 'success'; data: T; }
interface ErrorState { status: 'error'; error: string; }

type AsyncState<T> = LoadingState | SuccessState<T> | ErrorState;

function handle<T>(state: AsyncState<T>) {
    switch (state.status) {
        case 'loading': /* ... */ break;
        case 'success': state.data; break;    // TS knows data exists
        case 'error': state.error; break;     // TS knows error exists
    }
}
```

### Template Literal Types

```ts
type EventName = 'click' | 'focus' | 'blur';
type EventHandler = `on${Capitalize<EventName>}`;  // 'onClick' | 'onFocus' | 'onBlur'
```

### Mapped Types

```ts
type Nullable<T> = { [K in keyof T]: T[K] | null };
type Prefixed<T, P extends string> = {
    [K in keyof T as `${P}${string & K}`]: T[K]
};
```

### Conditional Types

```ts
type ElementOf<T> = T extends (infer E)[] ? E : never;
type AsyncReturnType<T> = T extends (...args: any[]) => Promise<infer R> ? R : never;
```

## React TypeScript Patterns

### Component Props

```ts
interface ButtonProps {
    variant: 'primary' | 'secondary';
    size?: 'sm' | 'md' | 'lg';
    children: ReactNode;
    onClick?: () => void;
}

// Extending HTML element props
interface InputProps extends ComponentProps<'input'> {
    label: string;
    error?: string;
}
```

### Hooks

```ts
const [user, setUser] = useState<User | null>(null);
const inputRef = useRef<HTMLInputElement>(null);
```

### Custom Hooks — `as const` for Tuple Returns

```ts
function useLocalStorage<T>(key: string, initialValue: T) {
    const [value, setValue] = useState<T>(initialValue);
    // ...
    return [value, setValue] as const;  // Returns readonly tuple, not array
}
```

## tsconfig.json — Recommended Strict Config

```json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "ESNext",
        "moduleResolution": "bundler",
        "strict": true,
        "noUncheckedIndexedAccess": true,
        "noImplicitReturns": true,
        "noFallthroughCasesInSwitch": true
    }
}
```

Key flags:
- **`strict`**: Enables `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, etc.
- **`noUncheckedIndexedAccess`**: Array/object index access returns `T | undefined` — catches real bugs.
- **`moduleResolution: "bundler"`**: Modern resolution for bundler-based projects.

## Declaration File Do's and Don'ts

### Types

- **Do** use lowercase primitives: `number`, `string`, `boolean`, `symbol`.
- **Don't** use boxed types: `Number`, `String`, `Boolean`, `Symbol`, `Object`.
- **Do** use `unknown` for values you won't directly manipulate. Minimize `any` outside migrations.

### Callback Return Types

- **Do** use `void` for callback return types you'll ignore.
- **Don't** use `any` for callback return types.

```ts
// Do
function register(callback: () => void): void;

// Don't
function register(callback: () => any): void;
```

### Callback Parameters

- **Don't** mark callback parameters as optional. Callbacks accepting fewer arguments are always legal in TypeScript — making params optional adds nothing and misleads.

```ts
// Do
function call(callback: (data: string, index: number) => void): void;

// Don't
function call(callback: (data: string, index?: number) => void): void;
```

### Overloads and Callbacks

- **Don't** write separate overloads that differ only by callback arity. Use a single signature with the maximum parameter count.

```ts
// Do
function beforeAll(action: (done: DoneFn) => void, timeout?: number): void;

// Don't
function beforeAll(action: () => void, timeout?: number): void;
function beforeAll(action: (done: DoneFn) => void, timeout?: number): void;
```

### Function Overload Ordering

- **Do** order overloads most-specific first. TypeScript picks the first match.

```ts
// Do
function fn(x: HTMLDivElement): string;
function fn(x: HTMLElement): number;
function fn(x: any): any;

// Don't — HTMLDivElement overload is unreachable
function fn(x: any): any;
function fn(x: HTMLElement): number;
function fn(x: HTMLDivElement): string;
```

### Overloads vs Optional Parameters

- **Do** use optional parameters instead of multiple overloads that differ only in trailing params.

```ts
// Do
function fn(x: string, y?: number): void;

// Don't
function fn(x: string): void;
function fn(x: string, y: number): void;
```

### Overloads vs Union Types

- **Do** use union types instead of overloads when parameter types differ at the same position.

```ts
// Do
function fn(x: string | number): void;

// Don't
function fn(x: string): void;
function fn(x: number): void;
```
