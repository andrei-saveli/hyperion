import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import Searchlight from "../searchlight.js";

const {
  MODEL, REVISION, SEARCH_POLICY, acceptMeasurement, catalogText, createSearchlight,
  namedMeasurements, rankMeasurements, scopeMessage,
} = Searchlight;

const { pipeline, env } = await import(process.env.SEARCHLIGHT_RUNTIME_FILE
  ? pathToFileURL(process.env.SEARCHLIGHT_RUNTIME_FILE).href
  : "@huggingface/transformers");
if (process.env.SEARCHLIGHT_CACHE) env.cacheDir = process.env.SEARCHLIGHT_CACHE;
env.allowLocalModels = false;
const encoder = await pipeline("feature-extraction", MODEL, { revision: REVISION, dtype: "q8" });
const read = (name) => readFile(new URL(name, import.meta.url), "utf8");
const { variables } = JSON.parse(await read("../data/variables.json"));

const calibrate = process.argv.includes("--calibrate");
const tsv = await read(calibrate ? "searchlight-development.tsv" : "searchlight-questions.tsv");
const rows = tsv.trim().split(/\r?\n/).slice(1).map((line) => {
  const [expected, question] = line.split("\t").slice(-2);
  return { question, expected };
});

function summarize(cases, resultField) {
  const supported = cases.filter(({ expected }) => expected !== "-");
  const unsupported = cases.filter(({ expected }) => expected === "-");
  return {
    correct: supported.filter((row) => row[resultField] === row.expected).length,
    wrong: supported.filter((row) => row[resultField] && row[resultField] !== row.expected).length,
    unsupportedMatches: unsupported.filter((row) => row[resultField]).length,
  };
}

async function calibration() {
  const embed = async (texts) => (await encoder(texts, { pooling: "mean", normalize: true })).tolist();
  const catalog = await embed(variables.map(catalogText));
  const queryVectors = await embed(rows.map(({ question }) => question));
  const ranked = queryVectors.map((vector) => rankMeasurements(vector, catalog, variables));
  const candidates = [];
  for (const score of [0.32, 0.36, 0.40, 0.44, 0.48, 0.52, 0.56]) {
    for (const margin of [0, 0.03, 0.06]) {
      const policy = { score, margin };
      const predictions = rows.map((row, i) => {
        const named = namedMeasurements(row.question, variables);
        const match = scopeMessage(row.question) || named.length > 1
          ? null : named[0] ?? acceptMeasurement(ranked[i], policy);
        return { ...row, searchlight: match?.code };
      });
      candidates.push({ policy, ...summarize(predictions, "searchlight") });
    }
  }
  const limit = Math.floor(0.10 * rows.filter((row) => row.expected === "-").length);
  const eligible = candidates.filter((c) => c.unsupportedMatches <= limit)
    .sort((a, b) => b.correct - a.correct || a.wrong - b.wrong || a.unsupportedMatches - b.unsupportedMatches
      || a.policy.margin - b.policy.margin || b.policy.score - a.policy.score);
  console.log(JSON.stringify({ selected: eligible[0], eligible }, null, 2));
}

function loadKeywordBaseline() {
  const source = execFileSync("git", ["show", "6ecad4677e17776ecd31d6b37272242eddaad560:Website/app.js"],
    { encoding: "utf8" });
  const startup = /Promise\.all\(\[\s*fetch\("data\/variables\.json"\)[\s\S]*?\n\}\);/;
  if (!startup.test(source)) throw new Error("Expected the pinned website initialization");
  const context = vm.createContext({ window: {}, variables });
  vm.runInContext(source.replace(startup, "VARS = variables;"), context);
  return vm.runInContext("understand", context);
}

async function evaluate() {
  const keyword = loadKeywordBaseline();
  const searchlight = createSearchlight(variables, SEARCH_POLICY, async () => encoder);
  const predictions = [];
  for (const row of rows) {
    predictions.push({
      ...row,
      searchlight: (await searchlight(row.question)).variable?.code ?? null,
      keyword: keyword(row.question).variable?.code ?? null,
    });
  }
  const supported = rows.filter((row) => row.expected !== "-").length;
  const results = {
    policy: SEARCH_POLICY, supported, unsupported: rows.length - supported,
    searchlight: summarize(predictions, "searchlight"),
    keyword: summarize(predictions, "keyword"),
  };
  if (process.argv.includes("--predictions")) results.predictions = predictions;
  console.log(JSON.stringify(results, null, 2));
}

if (calibrate) await calibration(); else await evaluate();
