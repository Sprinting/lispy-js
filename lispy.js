// Lispy: Scheme Interpreter in JavaScript
// Adapted from Peter Norvig's Lispy (https://norvig.com/lispy.html)
const Symbol = String;
// Logically types, and Lispy2 would actually require me to implement it, but lispy is too simple.
//const List = Array;
const number = (x) => parseFloat(x);
/*
Stuff to do: implement TCO, so you can properly use some recurison. Probably will be trampolies
This is pretty much a 1-to-1 mapping of Peter Norvig's Lispy, which I found while going through 
the excellent "Crafting Interpreters"

This little scheme lookalike is much much easier to implement, and helped be understand the book 
much better.
*/

class LispyCallable {
  call(...args) {
    throw new Error("Not implemented");
  }
}

class Builtin extends LispyCallable {
  constructor(fn) {
    super();
    this.fn = fn;
  }

  call(...args) {
    return this.fn(...args);
  }
}

class Procedure extends LispyCallable {
  constructor(parms, body, env) {
    super();
    this.parms = parms;
    this.body = body;
    this.env = env;
  }

  call(...args) {
    return evaluate(this.body, new Env(this.parms, args, this.env));
  }
}

function standardEnv() {
  const env = new Env();

  // Add basic arithmetic and comparison operators
  const basicOps = {
    "+": (a, b) => a + b,
    "-": (a, b) => a - b,
    "*": (a, b) => a * b,
    "/": (a, b) => a / b,
    ">": (a, b) => a > b,
    "<": (a, b) => a < b,
    ">=": (a, b) => a >= b,
    "<=": (a, b) => a <= b,
    "=": (a, b) => a === b,
  };

  // Add Math functions and constants
  Object.getOwnPropertyNames(Math).forEach((name) => {
    if (typeof Math[name] === "function") {
      env.set(
        name.toLowerCase(),
        new Builtin((...args) => Math[name](...args))
      );
    } else {
      env.set(name.toUpperCase(), Math[name]);
    }
  });

  // Add basic operators
  Object.entries(basicOps).forEach(([name, fn]) => {
    env.set(name, new Builtin(fn));
  });

  // Add other Scheme standard procedures
  env.update({
    append: new Builtin((a, b) => a.concat(b)),
    apply: new Builtin((fn, args) => fn.call(...args)),
    begin: new Builtin((...x) => x[x.length - 1]),
    car: new Builtin((x) => x[0]),
    cdr: new Builtin((x) => x.slice(1)),
    cons: new Builtin((x, y) => [x].concat(y)),
    "eq?": new Builtin((a, b) => a === b),
    "equal?": new Builtin((a, b) => a == b),
    length: new Builtin((x) => x.length),
    list: new Builtin((...x) => x),
    "list?": new Builtin(Array.isArray),
    map: new Builtin((fn, ...arrays) =>
      arrays[0].map((_, i) => fn.call(...arrays.map((a) => a[i])))
    ),
    max: new Builtin(Math.max),
    min: new Builtin(Math.min),
    not: new Builtin((x) => !x),
    "null?": new Builtin((x) => x.length === 0),
    "number?": new Builtin((x) => typeof x === "number"),
    "procedure?": new Builtin((x) => x instanceof LispyCallable),
    "symbol?": new Builtin((x) => typeof x === "string"),
    "env?": new Builtin(() => displayEnv(env)), // Add the env? function
  });

  return env;
}

class Env {
  constructor(parms = [], args = [], outer = null) {
    this.outer = outer;
    this._map = new Map(parms.map((p, i) => [p, args[i]]));
  }

  find(name) {
    if (this._map.has(name)) {
      return this;
    } else if (this.outer !== null) {
      return this.outer.find(name);
    } else {
      throw new Error(`Undefined variable: ${name}`);
    }
  }

  get(name) {
    return this.find(name)._map.get(name);
  }

  set(name, value) {
    this._map.set(name, value);
  }

  update(obj) {
    for (let [k, v] of Object.entries(obj)) {
      this._map.set(k, v);
    }
  }
}

function evaluate(expr, env) {
  if (typeof expr === "string") {
    return env.get(expr);
  } else if (typeof expr === "number") {
    return expr;
  } else if (Array.isArray(expr)) {
    const [op, ...args] = expr;
    if (op === "quote") {
      return args[0];
    } else if (op === "if") {
      const [test, conseq, alt] = args;
      const exp = evaluate(test, env) ? conseq : alt;
      return evaluate(exp, env);
    } else if (op === "define") {
      const [symbol, exp] = args;
      env.set(symbol, evaluate(exp, env));
    } else if (op === "lambda") {
      const [parms, body] = args;
      return new Procedure(parms, body, env);
    } else {
      const proc = evaluate(op, env);
      const argVals = args.map((arg) => evaluate(arg, env));
      if (proc instanceof LispyCallable) {
        return proc.call(...argVals);
      } else if (typeof proc === "function") {
        return proc(...argVals);
      } else {
        return proc;
      }
    }
  } else {
    throw new Error(`Unknown expression type: ${expr}`);
  }
}

const parse = (program) => {
  return read_from_tokens(tokenise(program));
};

const tokenise = (string) => {
  return string
    .replace(/\(/g, " ( ")
    .replace(/\)/g, " ) ")
    .trim()
    .split(/\s+/)
    .filter((token) => token !== "");
};

const read_from_tokens = (tokens) => {
  if (tokens.length === 0) {
    throw new SyntaxError("Unexpected end of file");
  }
  const token = tokens.shift();
  switch (token) {
    case "(":
      let L = [];
      while (tokens[0] !== ")") {
        L.push(read_from_tokens(tokens));
      }
      tokens.shift();
      return L;
    case ")":
      throw new SyntaxError("Unmatched ')'");
    default:
      return atom(token);
  }
};

const atom = (token) => {
  const num = number(token);
  return isNaN(num) ? Symbol(token) : num;
};

// Helper function to display the environment
function displayEnv(env) {
  let current = env;
  let envString = "";
  let level = 0;

  while (current) {
    envString += `Environment level ${level}:\n`;
    for (let [key, value] of current._map) {
      envString += `  ${key}: ${schemeString(value)}\n`;
    }
    current = current.outer;
    level++;
  }
  console.log(envString);
  return envString;
}

// REPL (Read-Eval-Print Loop)
// function repl(prompt = "lispy> ") {
//   const readline = require("readline");
//   const rl = readline.createInterface({
//     input: process.stdin,
//     output: process.stdout,
//     prompt: prompt,
//   });

//   const env = standardEnv();

//   rl.prompt();

//   rl.on("line", (line) => {
//     try {
//       if (line.trim() === "(exit)") {
//         rl.close();
//         return;
//       }
//       const result = evaluate(parse(line), env);
//       console.log(schemeStr(result));
//     } catch (e) {
//       console.error(e.message);
//     }
//     rl.prompt();
//   }).on("close", () => {
//     console.log("Goodbye!");
//     process.exit(0);
//   });
// }

// Helper function to convert JavaScript values to Scheme strings
function schemeString(exp) {
  if (Array.isArray(exp)) {
    return "(" + exp.map(schemeString).join(" ") + ")";
  } else if (exp instanceof Procedure) {
    return "#<procedure>";
  } else if (exp instanceof Builtin) {
    return "#<builtin-procedure>";
  } else if (exp === true) {
    return "#t";
  } else if (exp === false) {
    return "#f";
  } else if (exp === undefined) {
    return "";
  } else if (typeof exp === "string" && exp.includes("\n")) {
    // Handle multi-line strings (like our env display)
    return exp;
  } else {
    return String(exp);
  }
}

// Run the REPL
// repl();
// // Run the REPL

// const env = standardEnv();
// console.log(evaluate(parse("(define x 10)"), env));
// console.log(evaluate(parse("(env?)"), env));
//module.exports = { evaluate, parse, standardEnv, schemeString };
