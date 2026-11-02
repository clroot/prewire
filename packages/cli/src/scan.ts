import { resolve } from 'node:path'
import { Node, Project, SyntaxKind, ts } from 'ts-morph'
import type { Identifier, ObjectLiteralExpression, SourceFile, TypeNode } from 'ts-morph'
import type { DiagnosticBag } from './diagnostics'
import type { ResolvedConfig } from './config'

const CORE_SPECIFIER = '@prewire/core'

/**
 * The type argument of a `TOKEN.of<...>()` specialization, identified
 * nominally by the declaration sites of the types it references.
 */
export interface Qualifier {
  /** Canonical identity, e.g. `/src/repo.ts#Repository</src/user.ts#User>`. */
  key: string
  /** Source text of the type argument, for diagnostics. */
  label: string
  /** Type names the generated export identifier is derived from. */
  nameParts: string[]
}

/**
 * Identity of a token: the module and exported variable name declaring it,
 * plus the type argument when the token is specialized with `.of<...>()`.
 */
export interface TokenRef {
  file: string
  name: string
  qualifier?: Qualifier
}

export type TokenId = string

export function tokenId(ref: TokenRef): TokenId {
  const base = `${ref.file}#${ref.name}`
  return ref.qualifier ? `${base}<${ref.qualifier.key}>` : base
}

export function describeToken(ref: TokenRef): string {
  const of = ref.qualifier ? `.of<${ref.qualifier.label}>()` : ''
  return `${ref.name}${of} (${ref.file})`
}

export interface BindingDecl {
  /** Absolute path of the module declaring the binding. */
  file: string
  /** Exported const name of the binding (imported by the generated root). */
  exportName: string
  provides: TokenRef
  /** dep name → token, read from the static deps object literal. */
  deps: Record<string, TokenRef>
  /** undefined = universal (valid in every environment). */
  environments?: string[]
  isDefault: boolean
  /**
   * Dep names the factory actually destructures, or null when the factory
   * takes the whole deps object and usage cannot be verified statically.
   */
  usedDepNames: string[] | null
}

export function createProject(config: ResolvedConfig): { project: Project; files: SourceFile[] } {
  const project = new Project({
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.Preserve,
      allowJs: false,
      skipLibCheck: true,
    },
  })
  for (const dir of config.include) {
    const base = resolve(config.rootDir, dir)
    project.addSourceFilesAtPaths([
      `${base}/**/*.{ts,tsx}`,
      `!${base}/**/*.gen.ts`,
      `!${base}/**/node_modules/**`,
    ])
  }
  return { project, files: project.getSourceFiles() }
}

/** Local names a file binds to the core `injectable` / `InjectionToken` exports. */
function coreImportAliases(file: SourceFile, exportName: string): Set<string> {
  const names = new Set<string>()
  for (const imp of file.getImportDeclarations()) {
    if (imp.getModuleSpecifierValue() !== CORE_SPECIFIER) continue
    for (const named of imp.getNamedImports()) {
      if (named.getName() === exportName) {
        names.add((named.getAliasNode() ?? named.getNameNode()).getText())
      }
    }
  }
  return names
}

/** Follows an identifier through import aliases to its declaring variable. */
function resolveTokenRef(idNode: Identifier, diagnostics: DiagnosticBag): TokenRef | undefined {
  const symbol = idNode.getSymbol()
  const target = symbol?.getAliasedSymbol() ?? symbol
  const decl = target?.getDeclarations().find(Node.isVariableDeclaration)
  if (!decl) {
    diagnostics.add(
      'INVALID_TOKEN_REF',
      `Cannot resolve "${idNode.getText()}" to a token declaration`,
      idNode.getSourceFile().getFilePath(),
    )
    return undefined
  }
  const init = decl.getInitializer()
  const isTokenNew =
    init !== undefined &&
    Node.isNewExpression(init) &&
    coreImportAliases(decl.getSourceFile(), 'InjectionToken').has(init.getExpression().getText())
  if (!isTokenNew) {
    diagnostics.add(
      'INVALID_TOKEN_REF',
      `"${idNode.getText()}" does not resolve to a \`new InjectionToken(...)\` declaration`,
      idNode.getSourceFile().getFilePath(),
    )
    return undefined
  }
  return { file: decl.getSourceFile().getFilePath(), name: decl.getName() }
}

const KEYWORD_TYPES = new Set([
  SyntaxKind.StringKeyword,
  SyntaxKind.NumberKeyword,
  SyntaxKind.BooleanKeyword,
  SyntaxKind.BigIntKeyword,
  SyntaxKind.SymbolKeyword,
  SyntaxKind.ObjectKeyword,
  SyntaxKind.UnknownKeyword,
  SyntaxKind.AnyKeyword,
  SyntaxKind.VoidKeyword,
  SyntaxKind.UndefinedKeyword,
  SyntaxKind.NeverKeyword,
])

interface QualifierPart {
  key: string
  names: string[]
}

/**
 * Reads a specialization type argument syntactically. Only named types
 * (with their own type arguments) and keyword types are accepted, each
 * named type keyed by its declaration site — so two structurally equal
 * types with different declarations never match.
 */
function parseQualifierType(node: TypeNode, diagnostics: DiagnosticBag): QualifierPart | undefined {
  const file = node.getSourceFile().getFilePath()
  if (KEYWORD_TYPES.has(node.getKind())) {
    return { key: node.getText(), names: [node.getText()] }
  }
  if (!Node.isTypeReference(node)) {
    diagnostics.add(
      'NON_STATIC_DECLARATION',
      `.of<${node.getText()}>() type argument must be built from named types and keyword types`,
      file,
    )
    return undefined
  }
  const typeName = node.getTypeName()
  const nameNode = Node.isQualifiedName(typeName) ? typeName.getRight() : typeName
  const symbol = nameNode.getSymbol()
  const target = symbol?.getAliasedSymbol() ?? symbol
  const decls = target?.getDeclarations() ?? []
  if (decls.some(Node.isTypeParameterDeclaration)) {
    diagnostics.add(
      'NON_STATIC_DECLARATION',
      `.of<...>() type argument "${nameNode.getText()}" is a type parameter — specializations must be concrete`,
      file,
    )
    return undefined
  }
  const decl = decls.find(
    (d) =>
      Node.isInterfaceDeclaration(d) ||
      Node.isTypeAliasDeclaration(d) ||
      Node.isClassDeclaration(d) ||
      Node.isEnumDeclaration(d),
  )
  if (!decl) {
    diagnostics.add(
      'NON_STATIC_DECLARATION',
      `Cannot resolve type "${nameNode.getText()}" in .of<...>() to a declaration`,
      file,
    )
    return undefined
  }
  const declName = target!.getName()
  const args: QualifierPart[] = []
  for (const arg of node.getTypeArguments()) {
    const part = parseQualifierType(arg, diagnostics)
    if (!part) return undefined
    args.push(part)
  }
  const base = `${decl.getSourceFile().getFilePath()}#${declName}`
  return {
    key: args.length === 0 ? base : `${base}<${args.map((a) => a.key).join(',')}>`,
    names: [declName, ...args.flatMap((a) => a.names)],
  }
}

/** Resolves a token expression: `TOKEN` or `TOKEN.of<Type>()`. */
function resolveTokenExpr(
  node: Node,
  what: string,
  diagnostics: DiagnosticBag,
): TokenRef | undefined {
  if (Node.isIdentifier(node)) return resolveTokenRef(node, diagnostics)

  const file = node.getSourceFile().getFilePath()
  const callee = Node.isCallExpression(node) ? node.getExpression() : undefined
  if (
    !Node.isCallExpression(node) ||
    !Node.isPropertyAccessExpression(callee) ||
    callee.getName() !== 'of' ||
    !Node.isIdentifier(callee.getExpression())
  ) {
    diagnostics.add(
      'NON_STATIC_DECLARATION',
      `${what} must reference a token identifier or \`TOKEN.of<Type>()\``,
      file,
    )
    return undefined
  }
  const typeArgs = node.getTypeArguments()
  if (typeArgs.length !== 1 || node.getArguments().length !== 0) {
    diagnostics.add(
      'NON_STATIC_DECLARATION',
      `${what}: \`.of<Type>()\` takes exactly one inline type argument and no arguments`,
      file,
    )
    return undefined
  }
  const base = resolveTokenRef(callee.getExpression() as Identifier, diagnostics)
  const part = parseQualifierType(typeArgs[0]!, diagnostics)
  if (!base || !part) return undefined
  // Repository<User> → [User]: the outer generic usually restates the port.
  const nameParts = part.names.length > 1 ? part.names.slice(1) : part.names
  return {
    ...base,
    qualifier: {
      key: part.key,
      label: typeArgs[0]!.getText().replace(/\s+/g, ' '),
      nameParts,
    },
  }
}

function parseDeps(
  obj: ObjectLiteralExpression,
  diagnostics: DiagnosticBag,
): Record<string, TokenRef> | undefined {
  const deps: Record<string, TokenRef> = {}
  for (const prop of obj.getProperties()) {
    let name: string
    let value: Node
    if (Node.isPropertyAssignment(prop)) {
      name = prop.getName()
      value = prop.getInitializerOrThrow()
    } else if (Node.isShorthandPropertyAssignment(prop)) {
      name = prop.getName()
      value = prop.getNameNode()
    } else {
      diagnostics.add(
        'NON_STATIC_DECLARATION',
        'deps must be a static object literal of name → token',
        obj.getSourceFile().getFilePath(),
      )
      return undefined
    }
    const ref = resolveTokenExpr(value, `dep "${name}"`, diagnostics)
    if (!ref) return undefined
    deps[name] = ref
  }
  return deps
}

interface ParsedOptions {
  provides: TokenRef
  environments?: string[]
  isDefault: boolean
}

function parseOptions(
  obj: ObjectLiteralExpression,
  diagnostics: DiagnosticBag,
): ParsedOptions | undefined {
  const file = obj.getSourceFile().getFilePath()
  let provides: TokenRef | undefined
  let environments: string[] | undefined
  let isDefault = false
  for (const prop of obj.getProperties()) {
    if (!Node.isPropertyAssignment(prop) && !Node.isShorthandPropertyAssignment(prop)) {
      diagnostics.add('NON_STATIC_DECLARATION', 'injectable options must be static literals', file)
      return undefined
    }
    const name = prop.getName()
    const value = Node.isPropertyAssignment(prop)
      ? prop.getInitializerOrThrow()
      : prop.getNameNode()
    if (name === 'provides') {
      provides = resolveTokenExpr(value, '"provides"', diagnostics)
      if (!provides) return undefined
    } else if (name === 'environment') {
      if (Node.isStringLiteral(value)) {
        environments = [value.getLiteralValue()]
      } else if (Node.isArrayLiteralExpression(value)) {
        environments = []
        for (const el of value.getElements()) {
          if (!Node.isStringLiteral(el)) {
            diagnostics.add(
              'NON_STATIC_DECLARATION',
              '"environment" must be string literal(s)',
              file,
            )
            return undefined
          }
          environments.push(el.getLiteralValue())
        }
      } else {
        diagnostics.add('NON_STATIC_DECLARATION', '"environment" must be string literal(s)', file)
        return undefined
      }
    } else if (name === 'default') {
      if (value.getKind() === SyntaxKind.TrueKeyword) {
        isDefault = true
      } else if (value.getKind() === SyntaxKind.FalseKeyword) {
        isDefault = false
      } else {
        diagnostics.add('NON_STATIC_DECLARATION', '"default" must be a boolean literal', file)
        return undefined
      }
    }
  }
  if (!provides) {
    diagnostics.add('NON_STATIC_DECLARATION', 'injectable options require "provides"', file)
    return undefined
  }
  return { provides, environments, isDefault }
}

/** Dep names the factory destructures; null when usage is not statically analyzable. */
function parseFactoryUsage(factory: Node, diagnostics: DiagnosticBag): string[] | null | undefined {
  if (!Node.isArrowFunction(factory) && !Node.isFunctionExpression(factory)) {
    diagnostics.add(
      'NON_STATIC_DECLARATION',
      'factory must be an inline arrow function or function expression',
      factory.getSourceFile().getFilePath(),
    )
    return undefined
  }
  const param = factory.getParameters()[0]
  if (!param) return []
  const nameNode = param.getNameNode()
  if (Node.isObjectBindingPattern(nameNode)) {
    const used: string[] = []
    for (const el of nameNode.getElements()) {
      used.push((el.getPropertyNameNode() ?? el.getNameNode()).getText())
    }
    return used
  }
  return null
}

export function scanBindings(files: SourceFile[], diagnostics: DiagnosticBag): BindingDecl[] {
  const bindings: BindingDecl[] = []
  for (const file of files) {
    const aliases = coreImportAliases(file, 'injectable')
    if (aliases.size === 0) continue
    for (const call of file.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const callee = call.getExpression()
      if (!Node.isIdentifier(callee) || !aliases.has(callee.getText())) continue

      const decl = call.getParent()
      const stmt = decl?.getParent()?.getParent()
      const isTopLevelExport =
        decl !== undefined &&
        Node.isVariableDeclaration(decl) &&
        stmt !== undefined &&
        Node.isVariableStatement(stmt) &&
        stmt.getParent() === file &&
        stmt.hasExportKeyword()
      if (!isTopLevelExport) {
        diagnostics.add(
          'BINDING_NOT_EXPORTED',
          'injectable() must be assigned to an exported top-level const so the generated root can import it',
          file.getFilePath(),
        )
        continue
      }

      const [depsArg, factoryArg, optionsArg] = call.getArguments()
      if (!depsArg || !factoryArg || !optionsArg) {
        diagnostics.add(
          'NON_STATIC_DECLARATION',
          'injectable(deps, factory, options) requires all three arguments inline',
          file.getFilePath(),
        )
        continue
      }
      if (!Node.isObjectLiteralExpression(depsArg) || !Node.isObjectLiteralExpression(optionsArg)) {
        diagnostics.add(
          'NON_STATIC_DECLARATION',
          'deps and options must be inline object literals',
          file.getFilePath(),
        )
        continue
      }

      const deps = parseDeps(depsArg, diagnostics)
      const options = parseOptions(optionsArg, diagnostics)
      const usedDepNames = parseFactoryUsage(factoryArg, diagnostics)
      if (!deps || !options || usedDepNames === undefined) continue

      if (usedDepNames !== null) {
        for (const depName of Object.keys(deps)) {
          if (!usedDepNames.includes(depName)) {
            diagnostics.add(
              'UNUSED_DEP',
              `dep "${depName}" is declared but never used by the factory of "${decl.getName()}"`,
              file.getFilePath(),
            )
          }
        }
      }

      bindings.push({
        file: file.getFilePath(),
        exportName: decl.getName(),
        provides: options.provides,
        deps,
        environments: options.environments,
        isDefault: options.isDefault,
        usedDepNames,
      })
    }
  }
  return bindings
}
