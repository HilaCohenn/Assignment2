import { makeProgram, Program } from './L32/L32-ast';
import {
    Exp, CExp,
    isDefineExp, isCExp,
    makeDefineExp,
    isAppExp, isIfExp, isProcExp, isLetExp,
    makeAppExp, makeIfExp, makeProcExp,
    makeVarRef, makeLitExp, makeVarDecl, makePrimOp,
    isDictExp, DictExp, isNumExp, isBoolExp, isStrExp,
    isPrimOp, isVarRef, isLitExp
} from "./L32/L32-ast";
import { makeCompoundSExp, makeSymbolSExp, makeEmptySExp, SExpValue } from "./L32/L32-value";
import { map } from "ramda";

// Convert CExp to SExp for dictionary entries - Enhanced version
const cexpToSExp = (exp: CExp): SExpValue => {
    if (isNumExp(exp)) return exp.val;
    if (isBoolExp(exp)) return exp.val;
    if (isStrExp(exp)) return exp.val;
    if (isPrimOp(exp)) return makeSymbolSExp(exp.op);
    if (isVarRef(exp)) return makeSymbolSExp(exp.var);
    if (isLitExp(exp)) return exp.val;
    if (isDictExp(exp)) {
        const dictSym = makeSymbolSExp('dict');
        const entries = exp.entries.map(entry => 
            makeCompoundSExp(
                makeSymbolSExp(entry.key),
                makeCompoundSExp(cexpToSExp(entry.val), makeEmptySExp())
            )
        );
        return [dictSym, ...entries].reduceRight<SExpValue>(
            (acc, curr) => makeCompoundSExp(curr, acc),
            makeEmptySExp()
        );
    }
    if (isAppExp(exp)) {
        const items = [exp.rator, ...exp.rands].map(cexpToSExp);
        return items.reduceRight<SExpValue>(
            (acc, curr) => makeCompoundSExp(curr, acc),
            makeEmptySExp()
        );
    }
    if (isProcExp(exp)) {
        const lambdaSym = makeSymbolSExp('lambda');
        const args = exp.args
            .map(arg => makeSymbolSExp(arg.var))
            .reduceRight<SExpValue>(
                (acc, curr) => makeCompoundSExp(curr, acc),
                makeEmptySExp()
            );
        const body = exp.body.map(cexpToSExp);
        return [lambdaSym, args, ...body].reduceRight<SExpValue>(
            (acc, curr) => makeCompoundSExp(curr, acc),
            makeEmptySExp()
        );
    }
    return makeEmptySExp();
};

// Transform dictionary to application
const rewriteDictExp = (exp: DictExp): CExp => {
    // Create pairs list ((key . val) ...)
    const pairs = exp.entries.map(entry => 
        makeCompoundSExp(
            makeSymbolSExp(entry.key),
            cexpToSExp(entry.val)
        )
    );
    
    // Convert to (dict '((key . val) ...))
    return makeAppExp(
        makeVarRef("dict"),
        [makeLitExp(buildSExpList(pairs))]
    );
};

// Build proper list structure
const buildSExpList = (xs: SExpValue[]): SExpValue =>
    xs.length === 0 ? makeEmptySExp() :
    makeCompoundSExp(xs[0], buildSExpList(xs.slice(1)));

// Recursively rewrite all expressions
const rewriteCExp = (exp: CExp): CExp =>
    isDictExp(exp) ? rewriteDictExp(exp) :
    isAppExp(exp) ? makeAppExp(rewriteCExp(exp.rator), map(rewriteCExp, exp.rands)) :
    isIfExp(exp) ? makeIfExp(rewriteCExp(exp.test), rewriteCExp(exp.then), rewriteCExp(exp.alt)) :
    isProcExp(exp) ? makeProcExp(exp.args, map(rewriteCExp, exp.body)) :
    exp;

// Rewrite top-level expressions
const rewriteExp = (exp: Exp): Exp =>
    isDefineExp(exp) ? makeDefineExp(exp.var, rewriteCExp(exp.val)) :
    isCExp(exp) ? rewriteCExp(exp) :
    exp;

export const Dict2App = (exp: Program): Program =>
    makeProgram(map(rewriteExp, exp.exps));

export const L32toL3 = (prog: Program): Program => {
    // Create dict function that performs lookup using only valid primitives
    const dictFunction = makeProcExp(
        [makeVarDecl("pairs")],
        [makeProcExp(
            [makeVarDecl("k")],
            [makeIfExp(
                makeAppExp(makePrimOp("pair?"), [makeVarRef("pairs")]),
                makeIfExp(
                    makeAppExp(makePrimOp("eq?"), 
                        [makeVarRef("k"),
                         makeAppExp(makePrimOp("car"), 
                            [makeAppExp(makePrimOp("car"), [makeVarRef("pairs")])])]),
                    makeAppExp(makePrimOp("cdr"), 
                        [makeAppExp(makePrimOp("car"), [makeVarRef("pairs")])]),
                    makeAppExp(
                        makeAppExp(makeVarRef("dict"), 
                            [makeAppExp(makePrimOp("cdr"), [makeVarRef("pairs")])]),
                        [makeVarRef("k")]
                    )
                ),
                makeLitExp(false)
            )]
        )]
    );

    // Add dict definition to program
    const dictDef = makeDefineExp(makeVarDecl("dict"), dictFunction);
    const transformed = Dict2App(prog);
    
    return makeProgram([dictDef, ...transformed.exps]);
};