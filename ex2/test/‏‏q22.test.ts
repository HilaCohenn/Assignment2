import fs from "fs";
import { expect } from 'chai';
import {  evalL32program } from '../src/L32/L32-eval';
import { Value } from "../src/L32/L32-value";
import { Result, bind, isFailure, makeFailure, makeOk } from "../src/shared/result";
import { parseL32, parseL32Exp } from "../src/L32/L32-ast";
import { makeEmptySExp } from "../src/L3/L3-value";

const evalP = (x: string): Result<Value> =>
    bind(parseL32(x), evalL32program);

describe.only('Q22 Tests', () => {

    it("Q22 basic tests 1", () => {
        expect(evalP(`(L32 ((dict (a 1) (b 2)) 'a))`)).to.deep.equal(makeOk(1));
    });
    
    it("Q22 tests 2", () => {
        expect(evalP(`(L32
                      (define x "a")
                      (define y "b")
                      ((dict (a x) (b y)) 'b))`)).to.deep.equal(makeOk("b"))
    });

    it("Q22 test 3", () => {
        expect(evalP(`(L32 
            (define x 1)
            (
              (if (< x 0)
                (dict (a 1) (b 2))
                (dict (a 2) (b 1)))
            'a))`)).to.deep.equal(makeOk(2));
    });
    
    
    it("Q22 test 5 - dict access with variable key", () => {
        expect(evalP(`(L32 
                        (define k 'a)
                        ((dict (a 42) (b 99)) k))`)).to.deep.equal(makeOk(42));
    });
    
    it("Q22 test 6 - key not found", () => {
        expect(evalP(`(L32 ((dict (a 1) (b 2)) 'c))`)).to.deep.equal(makeFailure("Key not found: c"));
    });
    
    it("Q22 test 7 - dict with different value types", () => {
        expect(evalP(`(L32 ((dict (x "hello") (y #t) (z 3.14)) 'x))`)).to.deep.equal(makeOk("hello"));
    });
    
    
    
    
});