import {Cpu} from './cpu';
import {Expr} from './expr';
import * as mod from './module';
import { SourceInfo, Token, TokenSource} from './token';
import {assertNever} from '../util';

type Chunk = mod.Chunk<number[]>;
type Module = mod.Module;
type Segment = mod.Segment;
const Segment = mod.Segment;

class Symbol {
  /**
   * Index into the global symbol array.  Only applies to immutable
   * symbols that need to be accessible at link time.  Mutable symbols
   * and symbols with known values at use time are not added to the
   * global list and are therefore have no id.  Mutability is tracked
   * by storing a -1 here.
   */
  id?: number;
  /** Whether the symbol has been explicitly scoped. */
  scoped?: boolean;
  /**
   * The expression for the symbol.  Must be a statically-evaluatable constant
   * for mutable symbols.  Undefined for forward-referenced symbols.
   */
  expr?: Expr;
  /** Name this symbol is exported as. */
  export?: string;
  /** Token where this symbol was ref'd. */
  ref?: {source?: SourceInfo}; // TODO - plumb this through
}

abstract class BaseScope {
  //closed = false;
  readonly symbols = new Map<string, Symbol>();

  protected pickScope(name: string): [string, BaseScope] {
    return [name, this];
  }

  // TODO - may need additional options:
  //   - lookup constant - won't return a mutable value or a value from
  //     a parent scope, implies no forward ref
  //   - shallow - don't recurse up the chain, for assignment only??
  // Might just mean allowForwardRef is actually just a mode string?
  //  * ca65's .definedsymbol is more permissive than .ifconst
  resolve(name: string, allowForwardRef: true): Symbol;
  resolve(name: string, allowForwardRef?: boolean): Symbol|undefined;
  resolve(name: string, allowForwardRef?: boolean): Symbol|undefined {
    const [tail, scope] = this.pickScope(name);
    let sym = scope.symbols.get(tail);
//console.log('resolve:',name,'sym=',sym,'fwd?',allowForwardRef);
    if (sym) {
      if (tail !== name) sym.scoped = true;
      return sym;
    }
    if (!allowForwardRef) return undefined;
    // if (scope.closed) throw new Error(`Could not resolve symbol: ${name}`);
    // make a new symbol - but only in an open scope
    //const symbol = {id: this.symbolArray.length};
//console.log('created:',symbol);
    //this.symbolArray.push(symbol);
    const symbol: Symbol = {};
    scope.symbols.set(tail, symbol);
    if (tail !== name) symbol.scoped = true;
    return symbol;
  }
}

class Scope extends BaseScope {
  readonly global: Scope;
  readonly children = new Map<string, Scope>();
  readonly anonymousChildren: Scope[] = [];

  constructor(readonly parent?: Scope, readonly kind?: 'scope'|'proc') {
    super();
    this.global = parent ? parent.global : this;
  }

  pickScope(name: string): [string, Scope] {
    // TODO - plumb the source information through here?
    let scope: Scope = this;
    const split = name.split(/::/g);
    const tail = split.pop()!;
    for (let i = 0; i < split.length; i++) {
      if (!i && !split[i]) { // global
        scope = scope.global;
        continue;
      }
      let child = scope.children.get(split[i]);
      while (!i && scope.parent && !child) {
        child = (scope = scope.parent).children.get(split[i]);
      }
      // If the name has an explicit scope, this is an error?
      if (!child) {
        const scopeName = split.slice(0, i + 1).join('::');
        throw new Error(`Could not resolve scope ${scopeName}`);
      }
      scope = child;
    }
    return [tail, scope];
  }

  // close() {
  //   if (!this.parent) throw new Error(`Cannot close global scope`);
  //   this.closed = true;
  //   // Any undefined identifiers in the scope are automatically
  //   // promoted to the parent scope.
  //   for (const [name, sym] of this.symbols) {
  //     if (sym.expr) continue; // if it's defined in the scope, do nothing
  //     const parentSym = this.parent.symbols.get(sym);
  //   }
  // }
}

class CheapScope extends BaseScope {

  /** Clear everything out, making sure everything was defined. */
  clear() {
    for (const [name, sym] of this.symbols) {
      if (!sym.expr) {
        const at = sym.ref ? Token.at(sym.ref) : '';
        throw new Error(`Cheap local label never defined: ${name}${at}`);
      }
    }
    this.symbols.clear();
  }
}

export class Assembler implements Expr.Resolver {

  /** The currently-open segment(s). */
  private segments: readonly string[] = ['code'];

  /** Data on all the segments. */
  private segmentData = new Map<string, Segment>();

  /** Stack of segments for .pushseg/.popseg. */
  private segmentStack: Array<readonly [readonly string[], Chunk?]> = [];

  /** All symbols in this object. */
  private symbols: Symbol[] = [];

  /** Global symbols. */
  // NOTE: we could add 'force-import', 'detect', or others...
  private globals = new Map<string, 'export'|'import'>();

  /** The current scope. */
  private currentScope = new Scope();

  /** A scope for cheap local labels. */
  private cheapLocals = new CheapScope();

  /** List of global symbol indices used by forward refs to anonymous labels. */
  private anonymousForward: number[] = [];

  /** List of chunk/offset positions of previous anonymous labels. */
  private anonymousReverse: Expr[] = [];

  /** Map of global symbol incides used by forward refs to relative labels. */
  private relativeForward: number[] = [];

  /** Map of chunk/offset positions of back-referable relative labels. */
  private relativeReverse: Expr[] = [];

  /** All the chunks so far. */
  private chunks: Chunk[] = [];

  /** Currently active chunk */
  private _chunk: Chunk|undefined = undefined;

  /** Origin of the currnet chunk, if fixed. */
  private _org: number|undefined = undefined;

  /** Prefix to prepend to all segment names. */
  private _segmentPrefix = '';

  /** Current source location, for error messages. */
  private _source?: SourceInfo;

  constructor(readonly cpu: Cpu, readonly opts: Assembler.Options = {}) {}

  private get chunk(): Chunk {
    // make chunk only when needed
    this.ensureChunk();
    return this._chunk!;
  }

  private ensureChunk() {
    if (!this._chunk) {
      // NOTE: multiple segments OK if disjoint memory...
      // if (this._org != null && this.segments.length !== 1) {
      //   this.fail(`.org chunks must be single-segment`);
      // }
      this._chunk = {segments: this.segments, data: []};
      if (this._org != null) this._chunk.org = this._org;
      this.chunks.push(this._chunk);
    }
  }

  definedSymbol(sym: string): boolean {
    // In this case, it's okay to traverse up the scope chain since if we
    // were to reference the symbol, it's guaranteed to be defined somehow.
    let scope: Scope|undefined = this.currentScope;
    const unscoped = !sym.includes('::');
    do {
      const s = scope.resolve(sym, false);
      if (s) return Boolean(s.expr);
    } while (unscoped && (scope = scope.parent));
    return false;
  }

  constantSymbol(sym: string): boolean {
    // If there's a symbol in a different scope, it's not actually constant.
    const s = this.currentScope.resolve(sym, false);
    return Boolean(s && s.expr && !(s.id! < 0));
  }

  referencedSymbol(sym: string): boolean {
    // If not referenced in this scope, we don't know which it is...
    // NOTE: this is different from ca65.
    const s = this.currentScope.resolve(sym, false);
    return s != null; // NOTE: this counts definitions.
  }

  evaluate(expr: Expr): number|undefined {
    expr = Expr.resolve(expr, this);
    return Expr.evaluate(expr);
  }

  // private get pc(): number|undefined {
  //   if (this._org == null) return undefined;
  //   return this._org + this.offset;
  // }

  resolve(name: string): Expr {
    if (name === '*') {
      // PC
      const num = this.chunk.data.length; // NOTE: before counting chunks
      return {op: 'off', chunk: this.chunks.length - 1, num};
    } else if (/^:\++$/.test(name)) {
      // anonymous forward ref
      const i = name.length - 2;
      let num = this.anonymousForward[i];
      if (num != null) return {op: 'sym', num};
      this.anonymousForward[i] = num = this.symbols.length;
      this.symbols.push({id: num});
      return {op: 'sym', num};
    } else if (/^\++$/.test(name)) {
      // relative forward ref
      let num = this.relativeForward[name.length - 1];
      if (num != null) return {op: 'sym', num};
      this.relativeForward[name.length - 1] = num = this.symbols.length;
      this.symbols.push({id: num});
      return {op: 'sym', num};
    } else if (/^:-+$/.test(name)) {
      // anonymous back ref
      const i = this.anonymousReverse.length - name.length + 1;
      if (i < 0) this.fail(`Bad anonymous backref: ${name}`);
      return this.anonymousReverse[i];
    } else if (/^-+$/.test(name)) {
      // relative back ref
      const expr = this.relativeReverse[name.length - 1];
      if (expr == null) this.fail(`Bad relative backref: ${name}`);
      return expr;
    }
    const scope = name.startsWith('@') ? this.cheapLocals : this.currentScope;
    const sym = scope.resolve(name, true);
    if (sym.expr) return sym.expr;
    // if the expression is not yet known then refer to the symbol table,
    // adding it if necessary.
    if (sym.id == null) {
      sym.id = this.symbols.length;
      this.symbols.push(sym);
    }
    return {op: 'sym', num: sym.id};
  }

  // No banks are resolved yet.
  chunkData(chunk: number): {org?: number} {
    // TODO - handle zp segments?
    return {org: this.chunks[chunk].org};
  }

  closeScopes() {
    this.cheapLocals.clear();
    // Need to find any undeclared symbols in nested scopes and link
    // them to a parent scope symbol if possible.
    function close(scope: Scope) {
      for (const child of scope.children.values()) {
        close(child);
      }
      for (const child of scope.anonymousChildren) {
        close(child);
      }
      for (const [name, sym] of scope.symbols) {
        if (sym.expr || sym.id == null) continue;
        if (scope.parent) {
          // TODO - record where it was referenced?
          if (sym.scoped) throw new Error(`Symbol '${name}' undefined`);
          const parentSym = scope.parent.symbols.get(name);
          if (!parentSym) {
            // just alias it directly in the parent scope
            scope.parent.symbols.set(name, sym);
          } else if (parentSym.id != null) {
            sym.expr = {op: 'sym', num: parentSym.id};
          } else if (parentSym.expr) {
            sym.expr = parentSym.expr;
          } else {
            // must have either id or expr...?
            throw new Error(`Impossible: ${name}`);
          }
        }
        // handle global scope separately...
      }
    }

    // test case: ref a name in two child scopes, define it in grandparent

    if (this.currentScope.parent) {
      // TODO - record where it was opened?
      throw new Error(`Scope never closed`);
    }
    close(this.currentScope);

    for (const [name, global] of this.globals) {
      const sym = this.currentScope.symbols.get(name);
      if (global === 'export') {
        if (!sym?.expr) throw new Error(`Symbol '${name}' undefined`);
        if (sym.id == null) {
          sym.id = this.symbols.length;
          this.symbols.push(sym);
        }
        sym.export = name;
      } else if (global === 'import') {
        if (!sym) continue; // okay to import but not use.
        // TODO - record both positions?
        if (sym.expr) throw new Error(`Already defined: ${name}`);
        sym.expr = {op: 'import', sym: name};
      } else {
        assertNever(global);
      }
    }

    for (const [name, sym] of this.currentScope.symbols) {
      if (!sym.expr) throw new Error(`Symbol '${name}' undefined`);
    }
  }

  module(): Module {
    this.closeScopes();

    // TODO - handle imports and exports out of the scope
    // TODO - add .scope and .endscope and forward scope vars at end to parent

    // Process and write the data
    const chunks: mod.Chunk<Uint8Array>[] = [];
    for (const chunk of this.chunks) {
      chunks.push({...chunk, data: Uint8Array.from(chunk.data)});
    }
    const symbols: mod.Symbol[] = [];
    for (const symbol of this.symbols) {
      if (symbol.expr == null) throw new Error(`Symbol undefined`);
      const out: mod.Symbol = {expr: symbol.expr};
      if (symbol.export != null) out.export = symbol.export;
      symbols.push(out);
    }
    const segments: Segment[] = [...this.segmentData.values()];
    return {chunks, symbols, segments};
  }

  line(tokens: Token[]) {
    this._source = tokens[0].source;
    if (tokens.length < 3 && Token.eq(tokens[tokens.length - 1], Token.COLON)) {
      this.label(tokens[0]);
    } else if (Token.eq(tokens[1], Token.ASSIGN)) {
      this.assign(Token.str(tokens[0]), this.parseExpr(tokens, 2));
    } else if (Token.eq(tokens[1], Token.SET)) {
      this.set(Token.str(tokens[0]), this.parseExpr(tokens, 2));
    } else if (tokens[0].token === 'cs') {
      this.directive(tokens);
    } else {
      this.instruction(tokens);
    }
  }

  tokens(source: TokenSource) {
    let line;
    while ((line = source.next())) {
      this.line(line);
    }
  }

  async tokensAsync(source: TokenSource.Async): Promise<void> {
    let line;
    while ((line = await source.nextAsync())) {
      this.line(line);
    }
  }


  directive(tokens: Token[]) {
    // TODO - record line information, rewrap error messages?
    switch (Token.str(tokens[0])) {
      case '.org': return this.org(this.parseConst(tokens));
      case '.reloc': return this.parseNoArgs(tokens), this.reloc();
      case '.assert': return this.assert(this.parseExpr(tokens));
      case '.segment': return this.segment(...this.parseSegmentList(tokens));
      case '.byte': return this.byte(...this.parseDataList(tokens, true));
      case '.res': return this.res(...this.parseResArgs(tokens));
      case '.word': return this.word(...this.parseDataList(tokens));
      case '.free': return this.free(this.parseConst(tokens), tokens[0]);
      case '.segmentprefix': return this.segmentPrefix(this.parseStr(tokens));
      case '.import': return this.import(...this.parseIdentifierList(tokens));
      case '.export': return this.export(...this.parseIdentifierList(tokens));
      case '.scope': return this.scope(this.parseOptionalIdentifier(tokens));
      case '.endscope': return this.parseNoArgs(tokens), this.endScope();
      case '.proc': return this.proc(this.parseRequiredIdentifier(tokens));
      case '.endproc': return this.parseNoArgs(tokens), this.endProc();
      case '.pushseg': return this.pushSeg(...this.parseSegmentList(tokens));
      case '.popseg': return this.parseNoArgs(tokens), this.popSeg();
      case '.move': return this.move(...this.parseMoveArgs(tokens));
    }
    this.fail(`Unknown directive: ${Token.nameAt(tokens[0])}`);
  }

  label(label: string|Token) {
    let ident: string;
    let token: Token|undefined;
    const expr = this.resolve('*');
    if (typeof label === 'string') {
      ident = label;
    } else {
      ident = Token.str(token = label);
      if (label.source) expr.source = label.source;
    }
    if (ident === ':') {
      // anonymous label - shift any forward refs off, and push onto the backs.
      this.anonymousReverse.push(expr);
      const sym = this.anonymousForward.shift();
      if (sym != null) this.symbols[sym].expr = expr;
      return;
    } else if (/^\++$/.test(ident)) {
      // relative forward ref - fill in global symbol we made earlier
      const sym = this.relativeForward[ident.length - 1];
      delete this.relativeForward[ident.length - 1];
      if (sym != null) this.symbols[sym].expr = expr;
      return;
    } else if (/^-+$/.test(ident)) {
      // relative backref - store the expr for later
      this.relativeReverse[ident.length - 1] = expr;
      return;
    }

    if (!ident.startsWith('@')) this.cheapLocals.clear();
    // TODO - handle anonymous and cheap local labels...
    this.assignSymbol(ident, false, expr, token);
    // const symbol = this.scope.resolve(str, true);
    // if (symbol.expr) throw new Error(`Already defined: ${label}`);
    // if (!this.chunk) throw new Error(`Impossible?`);
    // const chunkId = this.chunks.length - 1; // must be AFTER this.chunk
    // symbol.expr = {op: 'off', num: this.offset, chunk: chunkId};
    // if (source) symbol.expr.source = source;
    // // Add the label to the current chunk...?
    // // Record the definition, etc...?
  }

  assign(ident: string, expr: Expr|number) {
    if (ident.startsWith('@')) {
      this.fail(`Cheap locals may only be labels: ${ident}`);
    }
    // Now make the assignment.
    if (typeof expr !== 'number') expr = Expr.resolve(expr, this);
    this.assignSymbol(ident, false, expr);
  }

  set(ident: string, expr: Expr|number) {
    if (ident.startsWith('@')) {
      this.fail(`Cheap locals may only be labels: ${ident}`);
    }
    // Now make the assignment.
    if (typeof expr !== 'number') expr = Expr.resolve(expr, this);
    this.assignSymbol(ident, true, expr);
  }

  assignSymbol(ident: string, mut: boolean, expr: Expr|number, token?: Token) {
    // NOTE: * _will_ get current chunk!
    if (typeof expr === 'number') expr = {op: 'num', num: expr};
    const scope = ident.startsWith('@') ? this.cheapLocals : this.currentScope;
    // NOTE: This is incorrect - it will look up the scope chain when it
    // shouldn't.  Mutables may or may not want this, immutables must not.
    // Whether this is tied to allowFwdRef or not is unclear.  It's also
    // unclear whether we want to allow defining symbols in outside scopes:
    //   ::foo = 43
    // FWIW, ca65 _does_ allow this, as well as foo::bar = 42 after the scope.
    let sym = scope.resolve(ident, !mut);
    if (sym && (mut !== (sym.id! < 0))) {
      this.fail(`Cannot change mutability of ${ident}`, token);
    } else if (mut && expr.op != 'num') {
      this.fail(`Mutable set requires constant`, token);
    } else if (!sym) {
      if (!mut) throw new Error(`impossible`);
      scope.symbols.set(ident, sym = {id: -1});
    } else if (!mut && sym.expr) {
      const orig =
          sym.expr.source ? `\nOriginally defined${Token.at(sym.expr)}` : '';
      const name = token ? Token.nameAt(token) :
          ident + (this._source ? Token.at({source: this._source}) : '');
      throw new Error(`Redefining symbol ${name}${orig}`);
    }
    sym.expr = expr;
  }

  instruction(mnemonic: string, arg: Arg): void;
  instruction(tokens: Token[]): void;
  instruction(...args: [Token[]]|[string, Arg]): void {
    let mnemonic: string;
    let arg: Arg;
    if (args.length === 1) {
      // handle the line...
      const tokens = args[0];
      mnemonic = Token.expectIdentifier(tokens[0]).toLowerCase();
      arg = this.parseArg(tokens);
    } else {
      [mnemonic, arg] = args;
      mnemonic = mnemonic.toLowerCase();
    }
    // may need to size the arg, depending.
    // cpu will take 'add', 'a,x', and 'a,y' and indicate which it actually is.
    const ops = this.cpu.op(mnemonic); // will throw if mnemonic unknown
    const m = arg[0];
    if (m === 'add' || m === 'a,x' || m === 'a,y') {
      // Special case for address mnemonics
      const expr = arg[1]!;
      const s = expr.size || 2;
      if (m === 'add' && s === 1 && 'zpg' in ops) {
        return this.opcode(ops.zpg!, 1, expr);
      } else if (m === 'add' && 'abs' in ops) {
        return this.opcode(ops.abs!, 2, expr);
      } else if (m === 'add' && 'rel' in ops) {
        return this.relative(ops.rel!, 1, expr);
      } else if (m === 'a,x' && s === 1 && 'zpx' in ops) {
        return this.opcode(ops.zpx!, 1, expr);
      } else if (m === 'a,x' && 'abx' in ops) {
        return this.opcode(ops.abx!, 2, expr);
      } else if (m === 'a,y' && s === 1 && 'zpy' in ops) {
        return this.opcode(ops.zpy!, 1, expr);
      } else if (m === 'a,y' && 'aby' in ops) {
        return this.opcode(ops.aby!, 2, expr);
      }
      this.fail(`Bad address mode ${m} for ${mnemonic}`);
    }
    // All other mnemonics
    if (m in ops) {
      const argLen = this.cpu.argLen(m);
      if (m === 'rel') return this.relative(ops[m]!, argLen, arg[1]!);
      return this.opcode(ops[m]!, argLen, arg[1]!);
    }
    this.fail(`Bad address mode ${m} for ${mnemonic}`);
  }

  parseArg(tokens: Token[]): Arg {
    // Look for parens/brackets and/or a comma
    if (tokens.length === 1) return ['imp'];
    const front = tokens[1];
    if (tokens.length === 2) {
      if (Token.isRegister(front, 'a')) return ['acc'];
    } else if (Token.eq(front, Token.IMMEDIATE)) {
      return ['imm', Expr.parseOnly(tokens, 2)];
    }
    // Look for relative or anonymous labels, which are not valid on their own
    if (Token.eq(front, Token.COLON) && tokens.length === 3 &&
        tokens[2].token === 'op' && /^[-+]+$/.test(tokens[2].str)) {
      // anonymous label
      return ['add', {op: 'sym', sym: ':' + tokens[2].str}];
    } else if (tokens.length === 2 && tokens[1].token === 'op' &&
               /^[-+]+$/.test(tokens[1].str)) {
      // relative label
      return ['add', {op: 'sym', sym: tokens[1].str}];
    }
    // it must be an address of some sort - is it indirect?
    if (Token.eq(front, Token.LP) ||
        (this.opts.allowBrackets && Token.eq(front, Token.LB))) {
      const close = Token.findBalanced(tokens, 1);
      if (close < 0) this.fail(`Unbalanced ${Token.name(front)}`, front);
      const args = Token.parseArgList(tokens, 2, close);
      if (!args.length) this.fail(`Bad argument`, front);
      const expr = Expr.parseOnly(args[0]);
      if (args.length === 1) {
        // either IND or INY
        if (Token.eq(tokens[close + 1], Token.COMMA) &&
            Token.isRegister(tokens[close + 2], 'y')) {
          Token.expectEol(tokens[close + 3]);
          return ['iny', expr];
        }
        Token.expectEol(tokens[close + 1]);
        return ['ind', expr];
      } else if (args.length === 2 && args[1].length === 1) {
        // INX
        if (Token.isRegister(args[1][0], 'x')) return ['inx', expr];
      }
      this.fail(`Bad argument`, front);
    }
    const args = Token.parseArgList(tokens, 1);
    if (!args.length) this.fail(`Bad arg`, front);
    const expr = Expr.parseOnly(args[0]);
    if (args.length === 1) return ['add', expr];
    if (args.length === 2 && args[1].length === 1) {
      if (Token.isRegister(args[1][0], 'x')) return ['a,x', expr];
      if (Token.isRegister(args[1][0], 'y')) return ['a,y', expr];
    }
    this.fail(`Bad arg`, front);
  }

  relative(op: number, arglen: number, expr: Expr) {
    // Can arglen ever be 2? (yes - brl on 65816)
    // Basic plan here is that we actually want a relative expr.
    // TODO - clean this up to be more efficient.
    // TODO - handle local/anonymous labels separately?
    // TODO - check the range somehow?
    const num = this.chunk.data.length + arglen + 1;
    const nextPc = {op: 'off', num, chunk: this.chunks.length - 1};
    const rel: Expr = {op: '-', args: [expr, nextPc]};
    if (expr.source) rel.source = expr.source;
    this.opcode(op, arglen, rel);
  }

  opcode(op: number, arglen: number, expr: Expr) {
    // Emit some bytes.
    if (arglen) expr = Expr.resolve(expr, this); // BEFORE opcode (in case of *)
    const {chunk} = this;
    chunk.data.push(op);
    if (arglen) this.append(expr, arglen);
    // TODO - for relative, if we're in the same chunk, just compare
    // the offset...
  }

  append(expr: Expr, size: number) {
    const {chunk} = this;
    expr = Expr.resolve(expr, this);
    let val = expr.num!;
//console.log('expr:', expr, 'val:', val);
    if (expr.op !== 'num') {
      // use a placeholder and add a substitution
      const offset = chunk.data.length;
      (chunk.subs || (chunk.subs = [])).push({offset, size, expr});
      this.writeNumber(chunk.data, size); // write goes after subs
    } else {
      this.writeNumber(chunk.data, size, val);
    }
  }

  ////////////////////////////////////////////////////////////////
  // Directive handlers

  org(addr: number) {
    this._org = addr;
    this._chunk = undefined;
  }

  reloc() {
    this._org = undefined;
    this._chunk = undefined;
  }

  segment(...segments: Array<string|Segment>) {
    // Usage: .segment "1a", "1b", ...
    this.segments = segments.map(s => typeof s === 'string' ? s : s.name);
    for (const s of segments) {
      if (typeof s === 'object') {
        const data = this.segmentData.get(s.name) || {name: s.name};
        this.segmentData.set(s.name, Segment.merge(data, s));
      }
    }
    this._chunk = undefined;
  }

  assert(expr: Expr) {
    expr = Expr.resolve(expr, this);
    const val = Expr.evaluate(expr);
    if (val != null) {
      if (!val) this.fail(`Assertion failed`, expr);
    } else {
      const {chunk} = this;
      (chunk.asserts || (chunk.asserts = [])).push(expr);
    }
  }

  byte(...args: Array<Expr|string|number>) {
    const {chunk} = this;
    for (const arg of args) {
      if (typeof arg === 'number') {
        this.writeNumber(chunk.data, 1, arg);
      } else if (typeof arg === 'string') {
        writeString(chunk.data, arg);
      } else {
        this.append(arg, 1);
      }
    }
  }

  res(count: number, value?: number) {
    if (!count) return;
    this.byte(...new Array(count).fill(value ?? 0));
  }

  word(...args: Array<Expr|number>) {
    const {chunk} = this;
    for (const arg of args) {
      if (typeof arg === 'number') {
        this.writeNumber(chunk.data, 2, arg);
      } else {
        this.append(arg, 2);
      }
    }
  }

  free(size: number, token?: Token) {
    // Must be in .org for a single segment.
    if (this.segments.length !== 1) {
      this.fail(`.free with non-unique segment: ${this.segments}`, token);
    } else if (this._org == null) {
      this.fail(`.free in .reloc mode`, token);
    } else if (size < 0) {
      this.fail(`.free with negative size: ${size}`, token);
    }
    // If we've got an open chunk, end it.
    if (this._chunk) {
      this._org += this._chunk.data.length;
    }
    this._chunk = undefined;
    // Ensure a segment object exists.
    const name = this.segments[0];
    let s = this.segmentData.get(name);
    if (!s) this.segmentData.set(name, s = {name});
    (s.free || (s.free = [])).push([this._org, this._org + size]);
    // Advance past the free space.
    this._org += size;
  }

  segmentPrefix(prefix: string) {
    // TODO - make more of a todo about changing this?
    this._segmentPrefix = prefix;
  }

  import(...idents: string[]) {
    for (const ident of idents) {
      this.globals.set(ident, 'import');
    }
  }

  export(...idents: string[]) {
    for (const ident of idents) {
      this.globals.set(ident, 'export');
    }
  }

  scope(name?: string) {
    this.enterScope(name, 'scope');
  }

  proc(name: string) {
    this.label(name);
    this.enterScope(name, 'proc');
  }

  enterScope(name: string|undefined, kind: 'scope'|'proc') {
    const existing = name ? this.currentScope.children.get(name) : undefined;
    if (existing) {
      if (this.opts.reentrantScopes) {
        this.currentScope = existing;
        return;
      }
      this.fail(`Cannot re-enter scope ${name}`);
    }
    const child = new Scope(this.currentScope, kind);
    if (name) {
      this.currentScope.children.set(name, child);
    } else {
      this.currentScope.anonymousChildren.push(child);
    }
    this.currentScope = child;
  }

  endScope() { this.exitScope('scope'); }
  endProc() { this.exitScope('proc'); }

  exitScope(kind: 'scope'|'proc') {
    if (this.currentScope.kind !== kind || !this.currentScope.parent) {
      this.fail(`.end${kind} without .${kind}`);
    }
    this.currentScope = this.currentScope.parent;
  }

  pushSeg(...segments: Array<string|Segment>) {
    this.segmentStack.push([this.segments, this._chunk]);
    this.segment(...segments);
  }

  popSeg() {
    if (!this.segmentStack.length) this.fail(`.popseg without .pushseg`);
    [this.segments, this._chunk] = this.segmentStack.pop()!;
  }

  move(size: number, source: Expr) {
    this.append({op: '.move', args: [source], size}, size);
  }

  // Utility methods for processing arguments

  parseConst(tokens: Token[], start = 1): number {
    const expr = Expr.resolve(Expr.parseOnly(tokens, start), this);
    const val = Expr.evaluate(expr);
    if (val != null) return val;
    this.fail(`Expression is not constant`, tokens[1]);
  }
  parseNoArgs(tokens: Token[], start = 1) {
    Token.expectEol(tokens[1]);
  }
  parseExpr(tokens: Token[], start = 1): Expr {
    return Expr.parseOnly(tokens, start);
  }
  // parseStringList(tokens: Token[], start = 1): string[] {
  //   return Token.parseArgList(tokens, 1).map(ts => {
  //     const str = Token.expectString(ts[0]);
  //     Token.expectEol(ts[1], "a single string");
  //     return str;
  //   });
  // }
  parseStr(tokens: Token[], start = 1): string {
    const str = Token.expectString(tokens[start]);
    Token.expectEol(tokens[start + 1], "a single string");
    return str;
  }

  parseSegmentList(tokens: Token[], start = 1): Array<string|Segment> {
    if (tokens.length < start + 1) {
      this.fail(`Expected a segment list`, tokens[start - 1]);
    }
    return Token.parseArgList(tokens, 1).map(ts => {
      const str = this._segmentPrefix + Token.expectString(ts[0]);
      if (ts.length === 1) return str;
      if (!Token.eq(ts[1], Token.COLON)) {
        this.fail(`Expected comma or colon: ${Token.name(ts[1])}`, ts[1]);
      }
      const seg = {name: str} as Segment;
      // TODO - parse expressions...
      const attrs = Token.parseAttrList(ts, 1); // : ident [...]
      for (const [key, val] of attrs) {
        switch (key) {
          case 'bank': seg.bank = this.parseConst(val, 0); break;
          case 'size': seg.size = this.parseConst(val, 0); break;
          case 'off': seg.offset = this.parseConst(val, 0); break;
          case 'mem': seg.memory = this.parseConst(val, 0); break;
          // TODO - I don't fully understand these...
          // case 'zeropage': seg.addressing = 1;
          default: this.fail(`Unknown segment attr: ${key}`);
        }
      }
      return seg;
    });
  }

  parseResArgs(tokens: Token[]): [number, number?] {
    const data = this.parseDataList(tokens);
    if (data.length > 2) this.fail(`Expected at most 2 args`, data[2]);
    if (!data.length) this.fail(`Expected at least 1 arg`);
    const count = Expr.evaluate(Expr.resolve(data[0], this));
    if (count == null) this.fail(`Expected constant count`);
    const val = data[1] && Expr.evaluate(Expr.resolve(data[1], this));
    if (data[1] && val == null) this.fail(`Expected constant value`);
    return [count, val];
  }

  parseDataList(tokens: Token[]): Array<Expr>;
  parseDataList(tokens: Token[], allowString: true): Array<Expr|string>;
  parseDataList(tokens: Token[], allowString = false): Array<Expr|string> {
    if (tokens.length < 2) {
      this.fail(`Expected a data list`, tokens[0]);
    }
    const out: Array<Expr|string> = [];
    for (const term of Token.parseArgList(tokens, 1)) {
      if (allowString && term.length === 1 && term[0].token === 'str') {
        out.push(term[0].str);
      } else {
        out.push(Expr.resolve(Expr.parseOnly(term), this));
      }
    }
    return out;
  }

  parseIdentifierList(tokens: Token[]): string[] {
    if (tokens.length < 2) {
      this.fail(`Expected identifier(s)`, tokens[0]);
    }
    const out: string[] = [];
    for (const term of Token.parseArgList(tokens, 1)) {
      if (term.length !== 1 || term[0].token !== 'ident') {
        this.fail(`Expected identifier: ${Token.name(term[0])}`, term[0]);
      }
      out.push(Token.str(term[0]));
    }
    return out;
  }

  parseOptionalIdentifier(tokens: Token[]): string|undefined {
    const tok = tokens[1];
    if (!tok) return undefined;
    const ident = Token.expectIdentifier(tok);
    Token.expectEol(tokens[2]);
    return ident;
  }

  parseRequiredIdentifier(tokens: Token[]): string {
    const ident = Token.expectIdentifier(tokens[1]);
    Token.expectEol(tokens[2]);
    return ident;
  }

  parseMoveArgs(tokens: Token[]): [number, Expr] {
    // .move 10, ident        ; must be an offset
    // .move 10, $1234, "seg" ; maybe support this?
    const args = Token.parseArgList(tokens, 1);
    if (args.length !== 2 /* && args.length !== 3 */) {
      this.fail(`Expected constant number, then identifier`);
    }
    const num = Expr.evaluate(Expr.resolve(Expr.parseOnly(args[0]), this));
    if (num == null) this.fail(`Expected a constant number`);

    // let segName = this.segments.length === 1 ? this.segments[0] : undefined;
    // if (args.length === 3) {
    //   if (args[2].length !== 1 || args[2][0].token !== 'str') {
    //     this.fail(`Expected a single segment name`, this.args[2][0]);
    //   }
    //   segName = args[2][0].str;
    // }
    // const seg = segName ? this.segmentData.get(segName) : undefined;

    let offset = Expr.resolve(Expr.parseOnly(args[1]), this);
    if (offset.op === 'off') {
      return [num, offset];
    // } else if (offset.op === 'num') {
    } else {
      this.fail(`Expected a constant offset`, args[1][0]);
    }
  }

  // Diagnostics

  fail(msg: string, at?: {source?: SourceInfo}): never {
    if (at?.source) throw new Error(msg + Token.at(at));
    throw new Error(msg + Token.at({source: this._source}));
  }

  writeNumber(data: number[], size: number, val?: number) {
    // TODO - if val is a signed/unsigned 32-bit number, it's not clear
    // whether we need to treat it one way or the other...?  but maybe
    // it doesn't matter since we're only looking at 32 bits anyway.
    const s = (size) << 3;
    if (val != null && (val < (-1 << s) || val >= (1 << s))) {
      const name = ['byte', 'word', 'farword', 'dword'][size - 1];
      this.fail(`Not a ${name}: $${val.toString(16)}`);
    }
    for (let i = 0; i < size; i++) {
      data.push(val != null ? val & 0xff : 0xff);
      if (val != null) val >>= 8;
    }
  }
}

function writeString(data: number[], str: string) {
  // TODO - support character maps (pass as third arg?)
  for (let i = 0; i < str.length; i++) {
    data.push(str.charCodeAt(i));
  }
}

type ArgMode =
    'add' | 'a,x' | 'a,y' | // pseudo modes
    'abs' | 'abx' | 'aby' |
    'imm' | 'ind' | 'inx' | 'iny' |
    'rel' | 'zpg' | 'zpx' | 'zpy';

export type Arg = ['acc' | 'imp'] | [ArgMode, Expr];

export namespace Assembler {
  export interface Options {
    allowBrackets?: boolean;
    reentrantScopes?: boolean;
  }
}
