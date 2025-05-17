import {
  Exp, Program, isBoolExp, isNumExp, isVarRef, isProcExp,
  isIfExp, isAppExp, isPrimOp, isDefineExp, isProgram,
  ProcExp, VarDecl,
  AppExp
} from './L3/L3-ast';
import { Result, makeFailure, makeOk, bind} from './shared/result';

/*
Purpose: Transform L2 AST to JavaScript program string
Signature: l2ToJS(l2AST)
Type: [EXP | Program] => Result<string>
*/
const bindResults = <T>(
  results: Result<T>[],
  cont: (values: T[]) => Result<string>): Result<string> =>
  results.every(r => r.tag === "Ok")
    ? cont(results.map(r => (r as any).value))
    : makeFailure("One or more sub-expressions failed");

export const l2ToJS = (exp: Exp | Program): Result<string>  => 
    isBoolExp(exp) ? makeOk(`${exp.val}`) :
    isNumExp(exp) ? makeOk(`${exp.val}`) :
    isVarRef(exp) ? makeOk(`${exp.var}`) :
    isProcExp(exp) ? bind(l2ToJS(exp.body[0]), body => makeOk(`((${exp.args.map((p: VarDecl) => p.var).join(",")}) => ${body})`)) :
    isIfExp(exp)? bind(l2ToJS(exp.test), tst =>
        bind(l2ToJS(exp.then), thn =>
        bind(l2ToJS(exp.alt), alt =>
          makeOk(`(${tst} ? ${thn} : ${alt})`)))) :
    isPrimOp(exp) ? makeOk(PrimOpToString(exp.op)) :
    isAppExp(exp) ? bind(l2ToJS(exp.rator), op =>
      bindResults(exp.rands.map(l2ToJS), args =>
        isPrimOp(exp.rator)
          ? PrimOpToJS(exp.rator.op, args)
          : makeOk(`${op}(${args.join(",")})`)
      )) :
    isDefineExp(exp) ?
    bind(l2ToJS(exp.val), val =>
      makeOk(`const ${exp.var.var} = ${val}`)):
    isProgram(exp) ?bindResults(exp.exps.map(l2ToJS), lines => makeOk(lines.join(";\n"))) :
    makeFailure(`Unknown expression type: ${exp}`);

const PrimOpToJS = (op: string, args: string[]): Result<string> =>
  op === "number?" ? makeOk(PrimOpToString(op)+`(${args[0]})`) :
  op === "boolean?" ? makeOk(PrimOpToString(op)+`(${args[0]})`) :
  op === "not" ? makeOk(`(!${args[0]})`) :
  op === "and" ? makeOk(`(${args[0]} && ${args[1]})`) :
  op === "or" ? makeOk(`(${args[0]} || ${args[1]})`) :
  op === "=" || op === "eq?" || op === "string=?" ? makeOk(`(${args[0]} === ${args[1]})`) :
  ["+", "-", "*", "/", "<", ">"].includes(op)
    ? makeOk(`(${args.join(` ${op} `)})`)
    : makeOk(`${op}(${args.join(",")})`);

    const PrimOpToString = (op: string): string =>
  op === "number?" ?`((x) => typeof(x) === 'number')` :
  op === "boolean?" ? `((x) => typeof(x) === 'boolean')` :
  op.toString(); //
