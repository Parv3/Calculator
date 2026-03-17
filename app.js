const exprEl = document.getElementById("expr");
const valueEl = document.getElementById("value");

/** @type {string} */
let expr = "";
/** @type {string} */
let entry = "0";
let justEvaluated = false;

function render() {
  exprEl.textContent = expr;
  valueEl.textContent = entry;
}

function setEntryFromNumber(n) {
  if (!Number.isFinite(n)) throw new Error("Non-finite");
  const s = String(n);
  entry = s === "-0" ? "0" : s;
}

function commitEntryIfNeeded() {
  if (entry === "" || entry === "0" || entry === "-") return;
  if (expr.endsWith(")")) expr += " ";
  expr += (expr && !expr.endsWith(" ") ? " " : "") + entry;
  entry = "0";
}

function lastNonSpaceChar(s) {
  for (let i = s.length - 1; i >= 0; i--) {
    const ch = s[i];
    if (ch !== " ") return ch;
  }
  return "";
}

function appendDigit(d) {
  if (justEvaluated) {
    expr = "";
    entry = "0";
    justEvaluated = false;
  }
  if (entry === "0") entry = d;
  else entry += d;
  render();
}

function appendDot() {
  if (justEvaluated) {
    expr = "";
    entry = "0";
    justEvaluated = false;
  }
  if (entry === "-") entry = "-0";
  if (!entry.includes(".")) entry += entry === "" ? "0." : ".";
  render();
}

function appendOperator(op) {
  if (justEvaluated) justEvaluated = false;

  if (entry !== "0" || entry.includes(".") || entry.startsWith("-")) {
    commitEntryIfNeeded();
  }

  const last = lastNonSpaceChar(expr);
  if (!expr) {
    if (op === "-") {
      entry = "-";
      render();
    }
    return;
  }
  if ("+-*/".includes(last)) {
    expr = expr.trimEnd().slice(0, -1) + op + " ";
  } else {
    expr = expr.trimEnd() + " " + op + " ";
  }
  render();
}

function clearAll() {
  expr = "";
  entry = "0";
  justEvaluated = false;
  render();
}

function backspace() {
  if (justEvaluated) {
    clearAll();
    return;
  }
  if (entry !== "0") {
    entry = entry.slice(0, -1);
    if (entry === "" || entry === "-") entry = "0";
    render();
    return;
  }
  if (expr) {
    expr = expr.trimEnd().slice(0, -1).trimEnd();
    render();
  }
}

function toggleSign() {
  if (justEvaluated) justEvaluated = false;
  if (entry === "0") {
    entry = "-";
    render();
    return;
  }
  if (entry.startsWith("-")) entry = entry.slice(1);
  else entry = "-" + entry;
  if (entry === "-0") entry = "0";
  render();
}

function percent() {
  if (justEvaluated) justEvaluated = false;
  const n = Number(entry);
  if (!Number.isFinite(n)) return;
  setEntryFromNumber(n / 100);
  render();
}

function normalizeExpressionForParse(s) {
  return s
    .replace(/[×]/g, "*")
    .replace(/[÷]/g, "/")
    .replace(/[−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(input) {
  const s = normalizeExpressionForParse(input);
  /** @type {Array<{t:'num',v:number}|{t:'op',v:string}|{t:'par',v:'(' | ')'}>} */
  const out = [];

  let i = 0;
  let prevType = "start";
  while (i < s.length) {
    const ch = s[i];
    if (ch === " ") {
      i++;
      continue;
    }

    if (ch === "(" || ch === ")") {
      out.push({ t: "par", v: ch });
      prevType = ch === "(" ? "lpar" : "rpar";
      i++;
      continue;
    }

    if ("+-*/".includes(ch)) {
      const isUnary = ch === "-" && (prevType === "start" || prevType === "op" || prevType === "lpar");
      out.push({ t: "op", v: isUnary ? "u-" : ch });
      prevType = "op";
      i++;
      continue;
    }

    if ((ch >= "0" && ch <= "9") || ch === ".") {
      let j = i;
      let seenDot = false;
      while (j < s.length) {
        const c = s[j];
        if (c === ".") {
          if (seenDot) break;
          seenDot = true;
          j++;
          continue;
        }
        if (c >= "0" && c <= "9") {
          j++;
          continue;
        }
        break;
      }
      const raw = s.slice(i, j);
      const n = Number(raw);
      if (!Number.isFinite(n)) throw new Error("Invalid number");
      out.push({ t: "num", v: n });
      prevType = "num";
      i = j;
      continue;
    }

    throw new Error(`Unexpected character: ${ch}`);
  }

  return out;
}

function toRpn(tokens) {
  const prec = { "u-": 3, "*": 2, "/": 2, "+": 1, "-": 1 };
  const rightAssoc = { "u-": true };

  /** @type {Array<ReturnType<typeof tokenize>[number]>} */
  const output = [];
  /** @type {Array<ReturnType<typeof tokenize>[number]>} */
  const stack = [];

  for (const tok of tokens) {
    if (tok.t === "num") {
      output.push(tok);
      continue;
    }
    if (tok.t === "op") {
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.t !== "op") break;
        const pTop = prec[top.v];
        const pTok = prec[tok.v];
        if (pTop > pTok || (pTop === pTok && !rightAssoc[tok.v])) {
          output.push(stack.pop());
        } else {
          break;
        }
      }
      stack.push(tok);
      continue;
    }
    if (tok.t === "par" && tok.v === "(") {
      stack.push(tok);
      continue;
    }
    if (tok.t === "par" && tok.v === ")") {
      let found = false;
      while (stack.length) {
        const top = stack.pop();
        if (top.t === "par" && top.v === "(") {
          found = true;
          break;
        }
        output.push(top);
      }
      if (!found) throw new Error("Mismatched parentheses");
      continue;
    }
  }

  while (stack.length) {
    const top = stack.pop();
    if (top.t === "par") throw new Error("Mismatched parentheses");
    output.push(top);
  }
  return output;
}

function evalRpn(rpn) {
  /** @type {number[]} */
  const st = [];
  for (const tok of rpn) {
    if (tok.t === "num") {
      st.push(tok.v);
      continue;
    }
    if (tok.t === "op") {
      if (tok.v === "u-") {
        if (st.length < 1) throw new Error("Bad expression");
        st.push(-st.pop());
        continue;
      }
      if (st.length < 2) throw new Error("Bad expression");
      const b = st.pop();
      const a = st.pop();
      let res;
      switch (tok.v) {
        case "+":
          res = a + b;
          break;
        case "-":
          res = a - b;
          break;
        case "*":
          res = a * b;
          break;
        case "/":
          if (b === 0) throw new Error("Divide by zero");
          res = a / b;
          break;
        default:
          throw new Error("Unknown op");
      }
      if (!Number.isFinite(res)) throw new Error("Non-finite");
      st.push(res);
      continue;
    }
    throw new Error("Bad token");
  }
  if (st.length !== 1) throw new Error("Bad expression");
  return st[0];
}

function evaluate() {
  const includeEntry =
    (entry !== "0" || entry.includes(".") || (entry.startsWith("-") && entry !== "-")) && entry !== "";
  const full = [expr.trim(), includeEntry ? entry : ""]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!full) return;

  try {
    const tokens = tokenize(full);
    const rpn = toRpn(tokens);
    const result = evalRpn(rpn);
    expr = full + " =";
    setEntryFromNumber(Number(result.toPrecision(14)));
    justEvaluated = true;
  } catch (e) {
    expr = full;
    entry = "Error";
    justEvaluated = true;
  }
  render();
}

function acceptPastedExpression(text) {
  const cleaned = normalizeExpressionForParse(text)
    .replace(/[^0-9+\-*/().\s]/g, "")
    .trim();
  if (!cleaned) return;
  expr = "";
  entry = "0";
  justEvaluated = false;

  try {
    const result = evalRpn(toRpn(tokenize(cleaned)));
    expr = cleaned + " =";
    setEntryFromNumber(Number(result.toPrecision(14)));
    justEvaluated = true;
  } catch {
    expr = cleaned;
    entry = "Error";
    justEvaluated = true;
  }
  render();
}

document.querySelector(".keys").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const action = btn.dataset.action;
  const input = btn.dataset.input;

  if (input) {
    if (input >= "0" && input <= "9") appendDigit(input);
    else if (input === ".") appendDot();
    else if ("+-*/".includes(input)) appendOperator(input);
    return;
  }

  switch (action) {
    case "clear":
      clearAll();
      break;
    case "backspace":
      backspace();
      break;
    case "equals":
      evaluate();
      break;
    case "sign":
      toggleSign();
      break;
    case "percent":
      percent();
      break;
    default:
      break;
  }
});

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  const k = e.key;
  if (k >= "0" && k <= "9") {
    appendDigit(k);
    return;
  }
  if (k === ".") {
    appendDot();
    return;
  }
  if (k === "+" || k === "-" || k === "*" || k === "/") {
    appendOperator(k);
    return;
  }
  if (k === "Enter" || k === "=") {
    e.preventDefault();
    evaluate();
    return;
  }
  if (k === "Backspace") {
    backspace();
    return;
  }
  if (k === "Escape") {
    clearAll();
    return;
  }
});

document.addEventListener("paste", (e) => {
  const text = e.clipboardData?.getData("text");
  if (!text) return;
  acceptPastedExpression(text);
});

render();
