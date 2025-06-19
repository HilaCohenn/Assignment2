import { makeProgram, Program } from './L32/L32-ast';
import {
     Exp, CExp, DefineExp,
    isProgram, isDefineExp, isCExp,
    makeDefineExp,
    isAppExp, isIfExp, isProcExp, isLetExp,
    makeAppExp, makeIfExp, makeProcExp, makeLetExp,
    makeVarRef, makeLitExp,
    isDictExp, DictExp, AppExp,isNumExp, isBoolExp, isStrExp,
    isPrimOp, isVarRef, isLitExp
} from "./L32/L32-ast";
import {  makeCompoundSExp, makeSymbolSExp, makeEmptySExp,SExpValue } from "./L32/L32-value";

import { map } from "ramda";
/*
Purpose: rewrite all occurrences of DictExp in a program to AppExp.
Signature: Dict2App (exp)
Type: Program -> Program
*/
export const Dict2App = (exp: Program): Program =>
    makeProgram(map(rewriteExp, exp.exps));

// Build a proper list of SExp pairs: ((a . val1) (b . val2)) → CompoundSExp
const buildSExpList = (xs: SExpValue[]): SExpValue =>
    xs.length === 0
        ? makeEmptySExp()
        : makeCompoundSExp(xs[0], buildSExpList(xs.slice(1)));

// Convert CExp to quoted SExpValue (syntax tree form)
const cexpToSExp = (exp: CExp): SExpValue =>
    isNumExp(exp) ? exp.val :
    isBoolExp(exp) ? exp.val :
    isStrExp(exp) ? exp.val :
    isPrimOp(exp) ? makeSymbolSExp(exp.op) :
    isVarRef(exp) ? makeSymbolSExp(exp.var) :
    isLitExp(exp) ? exp.val :
    isAppExp(exp)
        ? makeCompoundSExp(
            cexpToSExp(exp.rator),
            buildSExpList(map(cexpToSExp, exp.rands))
        ) :
    isProcExp(exp)
        ? buildSExpList([
            makeSymbolSExp("lambda"),
            buildSExpList(map(p => makeSymbolSExp(p.var), exp.args)),
            buildSExpList(map(cexpToSExp, exp.body))
        ]) :
    isIfExp(exp)
        ? buildSExpList([
            makeSymbolSExp("if"),
            cexpToSExp(exp.test),
            cexpToSExp(exp.then),
            cexpToSExp(exp.alt)
        ]) :
    isLetExp(exp)
        ? buildSExpList([
            makeSymbolSExp("let"),
            buildSExpList(map(b =>
                buildSExpList([
                    makeSymbolSExp(b.var.var),
                    cexpToSExp(b.val)
                ]), exp.bindings)),
            ...map(cexpToSExp, exp.body)
        ]) :
    isDictExp(exp)
    buildSExpList([makeSymbolSExp("unsupported")]);

// Transform (dict ...) → (dict '((a . val) ...))
const rewriteDictExp = (exp: DictExp): CExp =>
    exp.entries.length === 0
        ? makeAppExp(makeVarRef("dict"), [makeLitExp(makeEmptySExp())])
        : makeAppExp(
            makeVarRef("dict"),
            [makeLitExp(buildSExpList(
                map(({ key, val }) =>
                    makeCompoundSExp(makeSymbolSExp(key), cexpToSExp(val)),
                exp.entries)
            ))]
        );

// Recursively rewrite all CExp forms
const rewriteCExp = (exp: CExp): CExp =>
    isDictExp(exp) ? rewriteDictExp(exp) :
    isAppExp(exp) ? makeAppExp(rewriteCExp(exp.rator), map(rewriteCExp, exp.rands)) :
    isIfExp(exp) ? makeIfExp(rewriteCExp(exp.test), rewriteCExp(exp.then), rewriteCExp(exp.alt)) :
    isProcExp(exp) ? makeProcExp(exp.args, map(rewriteCExp, exp.body)) :
    isLetExp(exp)
        ? makeLetExp(
            exp.bindings.map(b => ({ tag: "Binding", var: b.var, val: rewriteCExp(b.val) })),
            map(rewriteCExp, exp.body)
        ) :
    exp;

// Rewrite top-level Exp (Define or CExp)
const rewriteExp = (exp: Exp): Exp =>
    isDefineExp(exp) ? makeDefineExp(exp.var, rewriteCExp(exp.val)) :
    isCExp(exp) ? rewriteCExp(exp) :
    exp;

/*
Purpose: Transform L32 program to L3
Signature: L32ToL3(prog)
Type: Program -> Program
*/
export const L32toL3 = (prog: Program): Program =>
    Dict2App(prog);