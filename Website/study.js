// Input and analysis for user-defined experiments. The view handles data acquisition.
const ByteMeStudy = (function (stats, investigation, workbench) {
  const headers = {
    monthly: ["month", "affected", "reference"],
    randomized: ["unit", "group", "outcome"],
  };

  function csvRows(source) {
    const rows = [];
    let row = [], cell = "", quoted = false, closedQuote = false;
    source = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
    for (let i = 0; i <= source.length; i++) {
      const char = i === source.length ? "\n" : source[i];
      if (quoted) {
        if (char === '"' && source[i + 1] === '"') {
          cell += '"';
          i++;
        } else if (char === '"') {
          quoted = false;
          closedQuote = true;
        } else {
          cell += char;
        }
        continue;
      }
      if (char === "," || char === "\n") {
        row.push(cell.trim());
        cell = "";
        closedQuote = false;
        if (char === "\n") {
          if (row.some(Boolean)) rows.push(row);
          row = [];
        }
      } else if (closedQuote || (char === '"' && cell.length)) {
        throw new Error("Check the quotation marks around your CSV fields.");
      } else if (char === '"') {
        quoted = true;
      } else {
        cell += char;
      }
    }
    if (quoted) throw new Error("A quoted CSV field is missing its closing quotation mark.");
    return rows;
  }

  function parseCSV(source, design) {
    const [heading, ...rows] = csvRows(source);
    const required = headers[design];
    if (!heading || !rows.length) throw new Error("Add a header row and at least one data row.");
    const names = heading.map((name) => name.toLowerCase());
    const columns = required.map((name) => names.indexOf(name));
    if (columns.includes(-1) || new Set(names).size !== names.length) {
      throw new Error(`Use distinct column headings, including ${required.join(", ")}.`);
    }
    const keys = new Set();
    return rows.map((row, index) => {
      const line = `Data row ${index + 1}`;
      if (row.length !== heading.length) throw new Error(`${line} has a different number of fields than the header.`);
      const [key, second, third] = columns.map((column) => row[column]);
      if (!key || keys.has(key)) throw new Error(`${line} needs a unique ${required[0]}.`);
      keys.add(key);
      function number(value) {
        if (!value) return null;
        if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value) || !Number.isFinite(Number(value))) {
          throw new Error(`${line} has an invalid measurement. Use numbers or leave missing values blank.`);
        }
        return Number(value);
      }
      if (design === "randomized") {
        const group = second.toLowerCase();
        if (!["treatment", "control"].includes(group)) {
          throw new Error(`${line} needs treatment or control in the group column.`);
        }
        return { group, value: number(third) };
      }
      if (!investigation.periodOf(key, "")) throw new Error(`${line} needs a month in YYYY-MM format.`);
      return { date: { year: Number(key.slice(0, 4)), month: Number(key.slice(5)) }, affected: number(second), reference: number(third) };
    });
  }

  function monthlyData(rows) {
    rows.sort((a, b) => investigation.monthText(a.date).localeCompare(investigation.monthText(b.date)));
    const dates = rows.map(({ date }) => date);
    const sides = ["affected", "reference"].map((key) => ({ dates, values: rows.map((row) => row[key]) }));
    return investigation.matchMonths(...sides);
  }

  function summarizeGroup(rows, label) {
    const members = rows.filter(({ group }) => group === label);
    const values = members.map(({ value }) => value).filter(Number.isFinite);
    const n = values.length;
    if (n < 2) throw new Error(`The ${label} group needs at least two independent units with outcomes.`);
    const mean = values.reduce((sum, value) => sum + value, 0) / n;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1);
    return { n, mean, variance, missing: members.length - n };
  }

  function randomizedComparison(rows) {
    const treatment = summarizeGroup(rows, "treatment");
    const control = summarizeGroup(rows, "control");
    const a = treatment.variance / treatment.n, b = control.variance / control.n;
    const estimate = treatment.mean - control.mean;
    const standardError = Math.sqrt(a + b);
    const degrees = (a + b) ** 2 / (a ** 2 / (treatment.n - 1) + b ** 2 / (control.n - 1));
    if (![estimate, standardError].every(Number.isFinite)) throw new Error("Rescale very large measurements to a smaller unit.");
    const margin = standardError > 0 ? stats.tCritical975(Math.max(1, Math.floor(degrees))) * standardError : null;
    return { estimate, interval: Number.isFinite(margin) ? [estimate - margin, estimate + margin] : null, treatment, control };
  }

  function datedComparison(paired, month, months) {
    const result = workbench.interventionComparison(paired, month, months);
    if (!result) throw new Error(`The selected design needs ${months * 2} months before ${month} and ${months} months from that date, with matching observations in both groups.`);
    if (![result.difference, result.placebo].every(Number.isFinite)) throw new Error("Rescale very large measurements to a smaller unit.");
    return result;
  }

  return { headers, parseCSV, monthlyData, randomizedComparison, datedComparison };
})(ByteMeStats, ByteMeInvestigation, ByteMeWorkbench);
