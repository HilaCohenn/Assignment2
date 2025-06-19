import { makeProgram, Program } from './L32/L32-ast';
import {
    Exp, CExp,
    isDefineExp, isCExp,
    makeDefineExp,
    isAppExp, isIfExp, isProcExp,
    makeAppExp, makeIfExp, makeProcExp,
    makeVarRef, makeLitExp, makeVarDecl, makePrimOp,
    isDictExp, DictExp, isNumExp, isBoolExp, isStrExp,
    isPrimOp, isVarRef, isLitExp
} from "./L32/L32-ast";
import { makeCompoundSExp, makeSymbolSExp, makeEmptySExp, SExpValue } from "./L32/L32-value";
import { map } from "ramda";

// Converts a list of SExpValues into a proper Lisp-style list (no reduceRight)
const buildSExpList = (items: SExpValue[]): SExpValue =>
    items.length === 0 ? makeEmptySExp() :
    makeCompoundSExp(items[0], buildSExpList(items.slice(1)));

// Converts a CExp to its corresponding SExpValue (no reduceRight)
const convertToSExp = (exp: CExp): SExpValue => {
    if (isNumExp(exp) || isBoolExp(exp) || isStrExp(exp)) return exp.val;
    if (isPrimOp(exp)) return makeSymbolSExp(exp.op);
    if (isVarRef(exp)) return makeSymbolSExp(exp.var);
    if (isLitExp(exp)) return exp.val;

    if (isDictExp(exp)) {
        const dictSymbol = makeSymbolSExp("dict");
        const entryList = exp.entries.map(entry =>
            makeCompoundSExp(
                makeSymbolSExp(entry.key),
                makeCompoundSExp(convertToSExp(entry.val), makeEmptySExp())
            )
        );
        return makeCompoundSExp(dictSymbol, buildSExpList(entryList));
    }

    if (isAppExp(exp)) {
        const all = [exp.rator, ...exp.rands].map(convertToSExp);
        return buildSExpList(all);
    }

    if (isProcExp(exp)) {
        const lambdaSym = makeSymbolSExp("lambda");
        const argsList = buildSExpList(exp.args.map(arg => makeSymbolSExp(arg.var)));
        const bodyList = buildSExpList(exp.body.map(convertToSExp));
        return makeCompoundSExp(lambdaSym, makeCompoundSExp(argsList, bodyList));
    }

    return makeEmptySExp();
};

// Translates a DictExp to AppExp: (dict '((key . val)...))
const transformDict = (dict: DictExp): CExp => {
    const keyValuePairs = dict.entries.map(entry =>
        makeCompoundSExp(
            makeSymbolSExp(entry.key),
            convertToSExp(entry.val)
        )
    );
    return makeAppExp(
        makeVarRef("dict"),
        [makeLitExp(buildSExpList(keyValuePairs))]
    );
};

// Recursively rewrites all sub-expressions (no DictExp remains)
const rewriteCExp = (exp: CExp): CExp =>
    isDictExp(exp) ? transformDict(exp) :
    isAppExp(exp) ? makeAppExp(rewriteCExp(exp.rator), map(rewriteCExp, exp.rands)) :
    isIfExp(exp) ? makeIfExp(rewriteCExp(exp.test), rewriteCExp(exp.then), rewriteCExp(exp.alt)) :
    isProcExp(exp) ? makeProcExp(exp.args, map(rewriteCExp, exp.body)) :
    exp;

const rewriteTopExp = (exp: Exp): Exp =>
    isDefineExp(exp) ? makeDefineExp(exp.var, rewriteCExp(exp.val)) :
    isCExp(exp) ? rewriteCExp(exp) :
    exp;

// === Exported functions ===

export const Dict2App = (prog: Program): Program =>
    makeProgram(map(rewriteTopExp, prog.exps));

export const L32toL3 = (prog: Program): Program => {
    const dictImpl = makeProcExp(
        [makeVarDecl("entries")],
        [makeProcExp(
            [makeVarDecl("key")],
            [makeIfExp(
                makeAppExp(makePrimOp("pair?"), [makeVarRef("entries")]),
                makeIfExp(
                    makeAppExp(makePrimOp("eq?"), [
                        makeVarRef("key"),
                        makeAppExp(makePrimOp("car"), [
                            makeAppExp(makePrimOp("car"), [makeVarRef("entries")])
                        ])
                    ]),
                    makeAppExp(makePrimOp("cdr"), [
                        makeAppExp(makePrimOp("car"), [makeVarRef("entries")])
                    ]),
                    makeAppExp(
                        makeAppExp(makeVarRef("dict"), [
                            makeAppExp(makePrimOp("cdr"), [makeVarRef("entries")])
                        ]),
                        [makeVarRef("key")]
                    )
                ),
                makeLitExp(false)
            )]
        )]
    );

    const dictDef = makeDefineExp(makeVarDecl("dict"), dictImpl);
    const transformed = Dict2App(prog);
    return makeProgram([dictDef, ...transformed.exps]);
};
