import {describe, it} from 'mocha';
import {expect} from 'chai';
import {Cpu} from '../../src/js/asm/cpu';
import {Expr} from '../../src/js/asm/expr';
import {Module} from '../../src/js/asm/module';
import {Assembler} from '../../src/js/asm/assembler';
import {Token} from '../../src/js/asm/token';
import * as util from 'util';

const [] = [util];

function ident(str: string): Token { return {token: 'ident', str}; }
function num(num: number): Token { return {token: 'num', num}; }
function str(str: string): Token { return {token: 'str', str}; }
function cs(str: string): Token { return {token: 'cs', str}; }
function op(str: string): Token { return {token: 'op', str}; }
const {COLON, COMMA, IMMEDIATE, LP, RP} = Token;
const ORG = cs('.org');
const RELOC = cs('.reloc');
const ASSERT = cs('.assert');
const SEGMENT = cs('.segment');

const [] = [str, COMMA, LP, RP, ORG, RELOC, ASSERT, SEGMENT];

describe('Assembler', function() {

  describe('Simple instructions', function() {
    it('should handle `lda #$03`', function() {
      const a = new Assembler(Cpu.P02);
      a.instruction([ident('lda'), IMMEDIATE, num(3)]);
      expect(strip(a.module())).to.eql({
        segments: [],
        chunks: [{segments: ['code'], data: Uint8Array.of(0xa9, 3)}],
        symbols: [],
      });
    });

    it('should handle `sta $02`', function() {
      const a = new Assembler(Cpu.P02);
      a.instruction([ident('sta'), num(2)]);
      expect(strip(a.module())).to.eql({
        segments: [],
        chunks: [{segments: ['code'], data: Uint8Array.of(0x85, 2)}],
        symbols: [],
      });
    });

    it('should handle `ldy $032f`', function() {
      const a = new Assembler(Cpu.P02);
      a.instruction([ident('ldy'), num(0x32f)]);
      expect(strip(a.module())).to.eql({
        segments: [],
        chunks: [{segments: ['code'], data: Uint8Array.of(0xac, 0x2f, 3)}],
        symbols: [],
      });
    });

    it('should handle `rts`', function() {
      const a = new Assembler(Cpu.P02);
      a.instruction([ident('rts')]);
      expect(strip(a.module())).to.eql({
        segments: [],
        chunks: [{segments: ['code'], data: Uint8Array.of(0x60)}],
        symbols: [],
      });
    });

    it('should handle `lda ($24),y`', function() {
      const a = new Assembler(Cpu.P02);
      a.instruction([ident('lda'), LP, num(0x24), RP, COMMA, ident('y')]);
      expect(strip(a.module())).to.eql({
        segments: [],
        chunks: [{segments: ['code'], data: Uint8Array.of(0xb1, 0x24)}],
        symbols: [],
      });
    });

    it('should handle `sta ($0320,x)`', function() {
      const a = new Assembler(Cpu.P02);
      a.instruction([ident('sta'), LP, num(0x320), COMMA, ident('x'), RP]);
      expect(strip(a.module())).to.eql({
        segments: [],
        chunks: [{segments: ['code'], data: Uint8Array.of(0x81, 0x20, 3)}],
        symbols: [],
      });
    });

    it('should handle `lsr`', function() {
      const a = new Assembler(Cpu.P02);
      a.instruction([ident('lsr')]);
      expect(strip(a.module())).to.eql({
        segments: [],
        chunks: [{segments: ['code'], data: Uint8Array.of(0x4a)}],
        symbols: [],
      });
    });

    it('should handle `lsr a`', function() {
      const a = new Assembler(Cpu.P02);
      a.instruction([ident('lsr'), ident('A')]);
      expect(strip(a.module())).to.eql({
        segments: [],
        chunks: [{segments: ['code'], data: Uint8Array.of(0x4a)}],
        symbols: [],
      });
    });

    it('should handle `ora $480,x`', function() {
      const a = new Assembler(Cpu.P02);
      a.instruction([ident('ora'), num(0x480), COMMA, ident('x')]);
      expect(strip(a.module())).to.eql({
        segments: [],
        chunks: [{segments: ['code'], data: Uint8Array.of(0x1d, 0x80, 4)}],
        symbols: [],
      });
    });
  });

  describe('Symbols', function() {
    it('should fill in an immediately-available value', function() {
      const a = new Assembler(Cpu.P02);
      a.assign('val', 0x23);
      a.instruction([ident('lda'), IMMEDIATE, ident('val')]);
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          data: Uint8Array.of(0xa9, 0x23),
        }],
        symbols: [],
        segments: [],
      });
    });

    it('should fill in an immediately-available label', function() {
      const a = new Assembler(Cpu.P02);
      a.org(0x9135);
      a.label('foo');
      a.instruction([ident('ldx'), IMMEDIATE, op('<'), ident('foo')]);
      a.instruction([ident('ldy'), IMMEDIATE, op('>'), ident('foo')]);
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          org: 0x9135,
          data: Uint8Array.of(0xa2, 0x35, 0xa0, 0x91),
        }],
        symbols: [],
        segments: [],
      });
    });

    it('should substitute a forward referenced value', function() {
      const a = new Assembler(Cpu.P02);
      a.instruction([ident('lda'), IMMEDIATE, ident('val')]);
      a.assign('val', 0x23);
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          data: Uint8Array.of(0xa9, 0xff),
          subs: [{offset: 1, size: 1, expr: {op: 'sym', num: 0}}],
        }],
        symbols: [{expr: {op: 'num', num: 0x23}}],
        segments: [],
      });
    });

    it('should substitute a forward referenced label', function() {
      const a = new Assembler(Cpu.P02);
      a.directive([cs('.org'), num(0x8000)]);
      a.instruction([ident('jsr'), ident('foo')]);
      a.instruction([ident('lda'), IMMEDIATE, num(0)]);
      a.label('foo');
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          org: 0x8000,
          data: Uint8Array.of(0x20, 0xff, 0xff,
                              0xa9, 0x00),
          subs: [{offset: 1, size: 2, expr: {op: 'sym', num: 0}}],
        }],
        symbols: [{expr: {op: 'off', chunk: 0, num: 5}}],
        segments: [],
      });
    });

    it('should allow overwriting mutable symbols', function() {
      const a = new Assembler(Cpu.P02);
      a.set('foo', 5);
      a.instruction([ident('lda'), IMMEDIATE, ident('foo')]);
      a.set('foo', 6);
      a.instruction([ident('lda'), IMMEDIATE, ident('foo')]);

      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          data: Uint8Array.of(0xa9, 5, 0xa9, 6),
        }],
        symbols: [], segments: []});
    });

    it('should not allow redefining immutable symbols', function() {
      const a = new Assembler(Cpu.P02);
      a.assign('foo', 5);
      expect(() => a.assign('foo', 5))
          .to.throw(Error, /Redefining symbol foo/);
      expect(() => a.label('foo')).to.throw(Error, /Redefining symbol foo/);
    });

    it('should not allow redefining labels', function() {
      const a = new Assembler(Cpu.P02);
      a.label('foo');
      expect(() => a.assign('foo', 5))
          .to.throw(Error, /Redefining symbol foo/);
      expect(() => a.label('foo')).to.throw(Error, /Redefining symbol foo/);
    });

    it('should substitute a formula', function() {
      const a = new Assembler(Cpu.P02);
      a.assign('val', {op: '+', args: [{op: 'num', num: 1},
                                       {op: 'sym', sym: 'x'}]});
      a.instruction([ident('lda'), IMMEDIATE, ident('val')]);
      a.assign('x', 2);
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          data: Uint8Array.of(0xa9, 0xff),
          subs: [{offset: 1, size: 1,
                  expr: {op: '+', args: [{op: 'num', num: 1},
                                         {op: 'sym', num: 0}]}}],
        }],
        symbols: [{expr: {op: 'num', num: 2}}],
        segments: [],
      });
    });
  });

  describe('Cheap locals', function() {
    it('should handle backward refs', function() {
      const a = new Assembler(Cpu.P02);
      a.label('@foo');
      a.instruction([ident('ldx'), IMMEDIATE, op('<'), ident('@foo')]);
      a.instruction([ident('ldy'), IMMEDIATE, op('>'), ident('@foo')]);
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          data: Uint8Array.of(0xa2, 0xff, 0xa0, 0xff),
          subs: [{
            offset: 1, size: 1,
            expr: {op: '<', size: 1, args: [{op: 'off', chunk: 0, num: 0}]},
          }, {
            offset: 3, size: 1,
            expr: {op: '>', size: 1, args: [{op: 'off', chunk: 0, num: 0}]},
          }],
        }],
        symbols: [],
        segments: [],
      });
    });

    it('should hanle forward refs', function() {
      const a = new Assembler(Cpu.P02);
      a.instruction([ident('jsr'), ident('@foo')]);
      a.instruction([ident('lda'), IMMEDIATE, num(0)]);
      a.label('@foo');
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          data: Uint8Array.of(0x20, 0xff, 0xff,
                              0xa9, 0x00),
          subs: [{offset: 1, size: 2, expr: {op: 'sym', num: 0}}],
        }],
        symbols: [{expr: {op: 'off', chunk: 0, num: 5}}],
        segments: [],
      });
    });

    it('should not allow using a cheap local name for non-labels', function() {
      const a = new Assembler(Cpu.P02);
      expect(() => a.assign('@foo', 5))
          .to.throw(Error, /Cheap locals may only be labels: @foo/);
    });

    it('should not allow reusing names in the same cheap scope', function() {
      const a = new Assembler(Cpu.P02);
      a.label('@foo');
      expect(() => a.label('@foo')).to.throw(Error, /Redefining symbol @foo/);
    });

    it('should clear the scope on a non-cheap label', function() {
      const a = new Assembler(Cpu.P02);
      a.label('@foo');
      a.instruction([ident('jsr'), ident('@foo')]);
      a.label('bar');
      a.instruction([ident('jsr'), ident('@foo')]);
      a.label('@foo');
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          data: Uint8Array.of(0x20, 0xff, 0xff,
                              0x20, 0xff, 0xff),
          subs: [
            {offset: 1, size: 2, expr: {op: 'off', chunk: 0, num: 0}},
            {offset: 4, size: 2, expr: {op: 'sym', num: 0}}],
        }],
        symbols: [{expr: {op: 'off', chunk: 0, num: 6}}],
        segments: [],
      });
    });

    it('should not clear the scope on a symbol', function() {
      const a = new Assembler(Cpu.P02);
      a.label('@foo');
      a.assign('bar', 2);
      expect(() => a.label('@foo')).to.throw(Error, /Redefining symbol @foo/);
    });

    it('should be an error if a cheap label is never defined', function() {
      const a = new Assembler(Cpu.P02);
      a.instruction([ident('jsr'), ident('@foo')]);
      expect(() => a.label('bar'))
          .to.throw(Error, /Cheap local label never defined: @foo/);
      expect(() => a.module())
          .to.throw(Error, /Cheap local label never defined: @foo/);
    });
  });

  describe('Anonymous labels', function() {
    it('should work for forward references', function() {
      const a = new Assembler(Cpu.P02);
      a.instruction([ident('bne'), op(':'), op('++')]);
      a.label(':');
      a.instruction([ident('bcc'), op(':'), op('+++')]);
      a.label(':'); // first target
      a.instruction([ident('lsr')]);
      a.label(':');
      a.instruction([ident('lsr')]);
      a.label(':'); // second target
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          data: Uint8Array.of(0xd0, 0xff, 0x90, 0xff, 0x4a, 0x4a),
          subs: [{offset: 1, size: 1,
                  expr: {op: '-', args: [{op: 'sym', num: 0},
                                         {op: 'off', num: 2, chunk: 0}]}},
                 {offset: 3, size: 1,
                  expr: {op: '-', args: [{op: 'sym', num: 1},
                                         {op: 'off', num: 4, chunk: 0}]}}],
        }],
        symbols: [{expr: {op: 'off', chunk: 0, num: 4}},
                  {expr: {op: 'off', chunk: 0, num: 6}}],
        segments: []});
    });

    it('should work for backward references', function() {
      const a = new Assembler(Cpu.P02);
      a.label(':'); // first target
      a.instruction([ident('lsr')]);
      a.label(':');
      a.instruction([ident('lsr')]);
      a.instruction([ident('lsr')]);
      a.label(':'); // second target
      a.instruction([ident('bne'), op(':'), op('---')]);
      a.label(':');
      a.instruction([ident('bcc'), op(':'), op('--')]);
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          data: Uint8Array.of(0x4a, 0x4a, 0x4a, 0xd0, 0xfb, 0x90, 0xfc),
        }],
        symbols: [], segments: []});
    });

    it('should allow one label for both forward directions', function() {
      const a = new Assembler(Cpu.P02);
      a.instruction([ident('bne'), op(':'), op('+')]);
      a.label(':');
      a.instruction([ident('bcc'), op(':'), op('-')]);
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          data: Uint8Array.of(0xd0, 0xff, 0x90, 0xfe),
          subs: [{offset: 1, size: 1,
                  expr: {op: '-', args: [{op: 'sym', num: 0},
                                         {op: 'off', num: 2, chunk: 0}]}}],
        }],
        symbols: [{expr: {op: 'off', num: 2, chunk: 0}}],
        segments: []});
    });
  });

  describe('Relative labels', function() {
    it('should work for forward references', function() {
      const a = new Assembler(Cpu.P02);
      a.instruction([ident('bne'), op('++')]);
      a.label('+');
      a.instruction([ident('bcc'), op('+++')]);
      a.label('++');
      a.instruction([ident('lsr')]);
      a.instruction([ident('lsr')]);
      a.label('+++');
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          data: Uint8Array.of(0xd0, 0xff, 0x90, 0xff, 0x4a, 0x4a),
          subs: [{offset: 1, size: 1,
                  expr: {op: '-', args: [{op: 'sym', num: 0},
                                         {op: 'off', num: 2, chunk: 0}]}},
                 {offset: 3, size: 1,
                  expr: {op: '-', args: [{op: 'sym', num: 1},
                                         {op: 'off', num: 4, chunk: 0}]}}],
        }],
        symbols: [{expr: {op: 'off', chunk: 0, num: 4}},
                  {expr: {op: 'off', chunk: 0, num: 6}}],
        segments: []});
    });

    it('should work for backward references', function() {
      const a = new Assembler(Cpu.P02);
      a.label('--'); // first target
      a.instruction([ident('lsr')]);
      a.instruction([ident('lsr')]);
      a.instruction([ident('lsr')]);
      a.label('-'); // second target
      a.instruction([ident('bne'), op('--')]);
      a.instruction([ident('bcc'), op('-')]);
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          data: Uint8Array.of(0x4a, 0x4a, 0x4a, 0xd0, 0xfb, 0x90, 0xfc),
        }],
        symbols: [], segments: []});
    });
  });

  describe('.byte', function() {
    it('should support numbers', function() {
      const a = new Assembler(Cpu.P02);
      a.byte(1, 2, 3);
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          data: Uint8Array.of(1, 2, 3),
        }],
        symbols: [], segments: []});
    });

    it('should support strings', function() {
      const a = new Assembler(Cpu.P02);
      a.byte('ab', 'cd');
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          data: Uint8Array.of(0x61, 0x62, 0x63, 0x64),
        }],
        symbols: [], segments: []});
    });

    it('should support expressions', function() {
      const a = new Assembler(Cpu.P02);
      a.directive([cs('.byte'), num(1), op('+'), num(2)]);
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          data: Uint8Array.of(3),
        }],
        symbols: [], segments: []});
    });

    it('should support expressions with backward refs', function() {
      const a = new Assembler(Cpu.P02);
      a.assign('q', 5);
      a.directive([cs('.byte'), ident('q')]);
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          data: Uint8Array.of(5),
        }],
        symbols: [], segments: []});
    });

    it('should support expressions with forward refs', function() {
      const a = new Assembler(Cpu.P02);
      a.directive([cs('.byte'), ident('q'), op('+'), num(1)]);
      a.label('q');
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          data: Uint8Array.of(0xff),
          subs: [{offset: 0, size: 1,
                  expr: {op: '+', args: [{op: 'sym', num: 0},
                                         {op: 'num', num: 1, size: 1}]}}],
        }],
        symbols: [{expr: {op: 'off', chunk: 0, num: 1}}],
        segments: []});
    });
  });

  describe('.word', function() {
    it('should support numbers', function() {
      const a = new Assembler(Cpu.P02);
      a.word(1, 2, 0x403);
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          data: Uint8Array.of(1, 0, 2, 0, 3, 4),
        }],
        symbols: [], segments: []});
    });

    it('should support expressions', function() {
      const a = new Assembler(Cpu.P02);
      a.directive([cs('.word'), num(1), op('+'), num(2)]);
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          data: Uint8Array.of(3, 0),
        }],
        symbols: [], segments: []});
    });

    it('should support expressions with backward refs', function() {
      const a = new Assembler(Cpu.P02);
      a.assign('q', 0x305);
      a.directive([cs('.word'), ident('q')]);
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          data: Uint8Array.of(5, 3),
        }],
        symbols: [], segments: []});
    });

    it('should support expressions with forward refs', function() {
      const a = new Assembler(Cpu.P02);
      a.directive([cs('.word'), ident('q'), op('+'), num(1)]);
      a.label('q');
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          data: Uint8Array.of(0xff, 0xff),
          subs: [{offset: 0, size: 2,
                  expr: {op: '+', args: [{op: 'sym', num: 0},
                                         {op: 'num', num: 1, size: 1}]}}],
        }],
        symbols: [{expr: {op: 'off', chunk: 0, num: 2}}],
        segments: []});
    });
  });

  describe('.segment', function() {
    it('should change the segment', function() {
      const a = new Assembler(Cpu.P02);
      a.segment('01');
      a.byte(4);
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['01'],
          data: Uint8Array.of(4),
        }], symbols: [], segments: []});
    });

    it('should allow multiple segments', function() {
      const a = new Assembler(Cpu.P02);
      a.segment('01', '02');
      a.byte(4);
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['01', '02'],
          data: Uint8Array.of(4),
        }], symbols: [], segments: []});
    });

    it('should configure the segment', function() {
      const a = new Assembler(Cpu.P02);
      a.assign('size', 100)
      a.directive([cs('.segment'), str('03'),
                   COLON, ident('bank'), num(2), op('+'), num(1),
                   COLON, ident('size'), ident('size')]);
      expect(strip(a.module())).to.eql({
        chunks: [], symbols: [], segments: [{
          name: '03',
          bank: 3,
          size: 100,
        }]});
    });

    it('should merge multiple attr lists', function() {
      const a = new Assembler(Cpu.P02);
      a.directive([cs('.segment'), str('02'), COLON, ident('bank'), num(2)]);
      a.directive([cs('.segment'), str('02'), COLON, ident('size'), num(200)]);
      expect(strip(a.module())).to.eql({
        chunks: [], symbols: [], segments: [{
          name: '02',
          bank: 2,
          size: 200,
        }]});
    });

    it('should track free regions', function() {
      const a = new Assembler(Cpu.P02);
      a.segment('02');
      a.org(0x8000);
      a.free(0x200);
      a.org(0x9000);
      a.free(0x400);
      expect(strip(a.module())).to.eql({
        chunks: [], symbols: [], segments: [{
          name: '02',
          free: [[0x8000, 0x8200], [0x9000, 0x9400]],
        }]});
    });

    it('should allow setting a prefix', function() {
      const a = new Assembler(Cpu.P02);
      a.segmentPrefix('cr:');
      a.directive([cs('.segment'), str('02')]);
      a.instruction([ident('lsr')]);
      expect(strip(a.module())).to.eql({
        chunks: [{segments: ['cr:02'], data: Uint8Array.of(0x4a)}],
        segments: [], symbols: [],
      });          
    });
  });

  describe('.assert', function() {
    it('should pass immediately when true', function() {
      const a = new Assembler(Cpu.P02);
      a.assert({op: 'num', num: 1});
      expect(strip(a.module())).to.eql({chunks: [], symbols: [], segments: []});
    });

    it('should fail immediately when false', function() {
      const a = new Assembler(Cpu.P02);
      expect(() => a.assert({op: 'num', num: 0}))
          .to.throw(Error, /Assertion failed/);
    });

    it('should defer indeterminate assertions to the linker', function() {
      const a = new Assembler(Cpu.P02);
      a.label('Foo');
      a.directive([cs('.assert'), ident('Foo'), op('>'), num(8)]);
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          data: Uint8Array.of(),
          asserts: [{op: '>', size: 1, args: [{op: 'off', chunk: 0, num: 0},
                                              {op: 'num', num: 8, size: 1}]}],
        }],
        symbols: [], segments: []});
    });
  });

  describe('.scope', function() {
    it('should not leak inner symbols to outer scopes', function() {
      const a = new Assembler(Cpu.P02);
      a.assign('bar', 12);
      a.scope('foo');
      a.assign('bar', 42);
      a.byte({op: 'sym', sym: 'bar'});
      a.endScope();
      a.byte({op: 'sym', sym: 'bar'});

      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          data: Uint8Array.of(42, 12),
        }],
        symbols: [], segments: [],
      });
    });

    it('should inherit outer definitions', function() {
      const a = new Assembler(Cpu.P02);
      a.scope();
      a.scope('foo');
      a.byte({op: 'sym', sym: 'bar'});
      a.endScope();
      a.scope();
      a.byte({op: 'sym', sym: 'bar'});
      a.endScope();
      a.endScope();
      a.assign('bar', 14);
      
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          data: Uint8Array.of(0xff, 0xff),
          subs: [
            {offset: 0, size: 1, expr: {op: 'sym', num: 0}},
            {offset: 1, size: 1, expr: {op: 'sym', num: 1}},
          ],
        }],
        symbols: [
          {expr: {op: 'num', num: 14}},
          {expr: {op: 'sym', num: 0}},
        ],
        segments: [],
      });
    });

    it('should allow writing into a scope', function() {
      const a = new Assembler(Cpu.P02);
      a.scope('foo');
      a.byte({op: 'sym', sym: 'bar'});
      a.endScope();
      a.assign('foo::bar', 13);
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          data: Uint8Array.of(0xff),
          subs: [{offset: 0, size: 1, expr: {op: 'sym', num: 0}}],
        }],
        symbols: [
          {expr: {op: 'num', num: 13}},
        ],
        segments: [],
      });
    });

    it('should allow reading out of a scope', function() {
      const a = new Assembler(Cpu.P02);
      a.scope('foo');
      a.assign('bar', 5);
      a.endScope();
      a.byte({op: 'sym', sym: 'foo::bar'});
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          data: Uint8Array.of(0x05),
        }],
        symbols: [], segments: [],
      });
    });
  });

  describe('.import', function() {
    it('should work before the reference', function() {
      const a = new Assembler(Cpu.P02);
      a.import('foo');
      a.byte({op: 'sym', sym: 'foo'});
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          data: Uint8Array.of(0xff),
          subs: [{offset: 0, size: 1, expr: {op: 'sym', num: 0}}],
        }],
        symbols: [{expr: {op: 'import', sym: 'foo'}}],
        segments: [],
      });
    });

    it('should work after the reference', function() {
      const a = new Assembler(Cpu.P02);
      a.byte({op: 'sym', sym: 'foo'});
      a.import('foo');
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          data: Uint8Array.of(0xff),
          subs: [{offset: 0, size: 1, expr: {op: 'sym', num: 0}}],
        }],
        symbols: [{expr: {op: 'import', sym: 'foo'}}],
        segments: [],
      });
    });

    it('should work in a scope', function() {
      const a = new Assembler(Cpu.P02);
      a.scope();
      a.byte({op: 'sym', sym: 'foo'});
      a.endScope();
      a.import('foo');
      expect(strip(a.module())).to.eql({
        chunks: [{
          segments: ['code'],
          data: Uint8Array.of(0xff),
          subs: [{offset: 0, size: 1, expr: {op: 'sym', num: 0}}],
        }],
        symbols: [{expr: {op: 'import', sym: 'foo'}}],
        segments: [],
      });
    });

    it('should emit nothing if unused', function() {
      const a = new Assembler(Cpu.P02);
      a.import('foo');
      a.byte(2);
      expect(strip(a.module())).to.eql({
        chunks: [{segments: ['code'], data: Uint8Array.of(2)}],
        symbols: [], segments: [],
      });
    });
  });

  describe('.export', function() {
    it('should export a later value', function() {
      const a = new Assembler(Cpu.P02);
      a.export('qux');
      a.assign('qux', 12);
      expect(strip(a.module())).to.eql({
        symbols: [{export: 'qux', expr: {op: 'num', num: 12}}],
        chunks: [], segments: [],
      });
    });

    it('should export an earlier value', function() {
      const a = new Assembler(Cpu.P02);
      a.assign('qux', 12);
      a.export('qux');
      expect(strip(a.module())).to.eql({
        symbols: [{export: 'qux', expr: {op: 'num', num: 12}}],
        chunks: [], segments: [],
      });
    });
  });

  // TODO - test all the error cases...
});

function strip(o: Module): Module {
  for (const s of o.symbols || []) {
    stripExpr(s.expr);
  }
  for (const c of o.chunks || []) {
    for (const a of c.asserts || []) {
      stripExpr(a);
    }
    for (const s of c.subs || []) {
      stripExpr(s.expr);
    }
  }
  return o;
  function stripExpr(e: Expr|undefined) {
    if (!e) return;
    delete e.source;
    for (const a of e.args || []) {
      stripExpr(a);
    }
  }
}
