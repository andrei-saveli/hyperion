// Searchlight ranks the NASA POWER catalog independently of locations and trend results.
const RUNTIME = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";
export const MODEL = "Xenova/all-MiniLM-L6-v2";
export const REVISION = "b93c588d2682bc2c3ced0fae8a50f3f48004185a";
// Frozen on development questions before scoring the fresh draft set.
export const SEARCH_POLICY = Object.freeze({ score: 0.40, margin: 0 });

// These scope checks describe what the monthly POWER catalog can answer.
const OUTSIDE_MONTHLY_RECORD = /\b(?:forecasts?|predict(?:ion|ions)?|tomorrow|next (?:hour|day|week|month|year)|right now|real[- ]time|hourly|hour by hour|subdaily|day by day|per hour)\b/i;
const OUTSIDE_MEASUREMENTS = /\b(?:pm\s*2[.·]?5|pm\s*10|nitrogen dioxide|no₂|no2|carbon (?:dioxide|monoxide)|greenhouse gas emissions|wind chill|feels[- ]like temperature|sea ice (?:extent|area|thickness)|glacier (?:extent|area|mass)|(?:reservoir|lake|river) (?:elevation|levels?|volume|discharge|flow)|groundwater (?:levels?|storage)|crop yield|earthquakes?|population|chlorophyll)\b/i;

export function scopeMessage(text) {
  if (OUTSIDE_MONTHLY_RECORD.test(text)) {
    return "Searchlight uses historical monthly observations. Forecasts and short-term observations are outside this record.";
  }
  if (OUTSIDE_MEASUREMENTS.test(text)) {
    return "That measurement is outside this site's NASA POWER catalog. Try another measurement or browse the map.";
  }
  return "";
}

function normalized(text) {
  return text.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}_]+/gu, " ").trim();
}

export function namedMeasurements(text, variables) {
  const words = ` ${normalized(text)} `;
  return variables.filter(({ code, name }) => (
    words.includes(` ${normalized(code)} `) || words.includes(` ${normalized(name)} `)
  ));
}

export function catalogText(variable) {
  return [variable.name, variable.definition, variable.keywords].join(" ");
}

export function rankMeasurements(queryEmbedding, catalogEmbeddings, variables) {
  return variables.map((variable, i) => {
    const score = catalogEmbeddings[i].reduce((sum, value, j) => sum + value * queryEmbedding[j], 0);
    return { variable, score };
  }).sort((a, b) => b.score - a.score);
}

export function acceptMeasurement(ranked, policy) {
  const [first, second] = ranked;
  if (!first || !Number.isFinite(first.score) || first.score < policy.score) return null;
  if (second && first.score - second.score < policy.margin) return null;
  return first.variable;
}

async function loadEncoder() {
  const { pipeline, env } = await import(RUNTIME);
  env.allowLocalModels = false;
  // Static hosts can serve this app without cross-origin isolation headers.
  env.backends.onnx.wasm.numThreads = 1;
  return pipeline("feature-extraction", MODEL, { revision: REVISION, device: "wasm", dtype: "q8" });
}

export function createSearchlight(variables, policy = SEARCH_POLICY, encoderLoader = loadEncoder) {
  let model;

  async function embed(encoder, texts) {
    return (await encoder(texts, { pooling: "mean", normalize: true })).tolist();
  }

  function load() {
    if (!model) {
      model = (async () => {
        const encoder = await encoderLoader();
        const catalogEmbeddings = await embed(encoder, variables.map(catalogText));
        return { encoder, catalogEmbeddings };
      })().catch((error) => {
        model = undefined;
        throw error;
      });
    }
    return model;
  }

  return async function suggest(text) {
    const message = scopeMessage(text);
    if (message) return { message };
    const named = namedMeasurements(text, variables);
    if (named.length === 1) return { variable: named[0] };
    if (named.length > 1) return { message: "Search for one measurement at a time, or choose one after opening the place." };
    const { encoder, catalogEmbeddings } = await load();
    const [queryEmbedding] = await embed(encoder, [text]);
    const ranked = rankMeasurements(queryEmbedding, catalogEmbeddings, variables);
    return { variable: acceptMeasurement(ranked, policy) };
  };
}
