// Understanding questions by meaning, when the keyword rules find no measurement.
//
// A small language model (all-MiniLM-L6-v2, a "sentence transformer", the same model as the team's
// Searchlight) turns any sentence into a list of 384 numbers, so that sentences with similar
// meanings get similar lists. We turn every measurement's name, definition and example phrases into
// such lists once, then compare the question with them: "Is the white stuff on the mountains
// thinning?" lands near "snow depth" although it shares no keyword with it.
//
// It runs entirely in the visitor's browser (files in models/ and vendor/, downloaded once by
// get_search_model.py). No account, no key, nothing is sent anywhere. It only chooses a
// measurement or an "we don't have that" note; every number still comes from NASA data and stats.js.
// If the files are missing, the search simply works with its rules alone.
const ByteMeMeaning = (function () {
  const MODEL = "all-MiniLM-L6-v2";
  // Bump when the pinned model, precision or pooling changes.
  const INDEX_VERSION = "all-MiniLM-L6-v2:751bff3:q8:mean:l2:1";
  const DIMENSIONS = 384;
  // Decision thresholds, chosen on the tuning questions in tests/meaning_questions.json and checked
  // on the held-out ones (node Website/tests/test_meaning.js). A question is matched only when the best
  // measurement is close enough (ACCEPT) and clearly closer than any unrelated one (MARGIN).
  const ACCEPT = 0.42;
  const MARGIN = 0.03;

  let pipe = null, index = null;

  // Load the model once (a few seconds the first time). Resolves to null if it can't be loaded.
  function load() {
    if (!pipe) {
      pipe = (async () => {
        const base = new URL(".", document.baseURI);
        const t = await import(new URL("vendor/transformers/transformers.min.js", base).href);
        t.env.allowRemoteModels = false;              // never download anything at run time
        t.env.allowLocalModels = true;
        t.env.localModelPath = new URL("models/", base).href;
        t.env.backends.onnx.wasm.wasmPaths = new URL("vendor/transformers/", base).href;
        return t.pipeline("feature-extraction", MODEL, { dtype: "q8", device: "wasm" });
      })().catch((e) => { console.warn("Search by meaning is off:", e.message || e); return null; });
    }
    return pipe;
  }

  // Sentences -> unit-length vectors (mean of the word vectors, as the model was trained)
  async function embed(texts) {
    const model = await load();
    if (!model) return null;
    const out = await model(texts, { pooling: "mean", normalize: true });
    return out.tolist();
  }
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  const list = (s) => (s || "").split(",").map((p) => p.trim()).filter(Boolean);

  // Short texts describing each topic: each measurement's name, definition and everyday examples
  // ("examples" in variables.json), and the topics we don't have that have a closest measurement.
  // The keyword phrases are left out: fragments such as "into the air from" match almost anything.
  function documents(vars, notAvailable) {
    const docs = [];
    vars.forEach((v) => {
      const topic = { kind: "variable", code: v.code, family: v.family || v.code, pair: v.pair || null };
      docs.push({ topic, text: v.name });
      docs.push({ topic, text: `${v.name}: ${v.definition}` });
      list(v.examples).forEach((p) => docs.push({ topic, text: p }));
    });
    notAvailable.forEach((n, i) => {
      if (!n.examples) return;            // forecasts, hourly data: the rules handle those
      const topic = { kind: "missing", index: i, family: `missing${i}` };
      [...list(n.examples), ...(n.words || "").split(" ").filter(Boolean)].forEach((p) => docs.push({ topic, text: p }));
    });
    return docs;
  }

  // Used by scripts/build_meaning_index.js with the same browser pipeline as search.
  async function buildIndex(vars, notAvailable) {
    const texts = documents(vars, notAvailable).map((d) => d.text);
    const vectors = await embed(texts);
    if (!vectors) throw new Error("Search model could not be loaded");
    return { version: INDEX_VERSION, texts, vectors };
  }

  // Load the bundled vectors once. Check the text order against the live catalog.
  async function prepare(vars, notAvailable) {
    if (!index) {
      index = (async () => {
        const docs = documents(vars, notAvailable);
        const response = await fetch(new URL("models/meaning-index.json", document.baseURI));
        if (!response.ok) throw new Error(`Search index returned ${response.status}`);
        const { version, texts, vectors } = await response.json();
        const offsets = new Map(texts.map((text, i) => [text, i * DIMENSIONS]));
        if (version !== INDEX_VERSION || docs.some((d) => !offsets.has(d.text))) throw new Error("Search index is out of date");
        const bytes = Uint8Array.from(atob(vectors), (c) => c.charCodeAt(0));
        if (bytes.byteLength !== texts.length * DIMENSIONS * 4) throw new Error("Search index has the wrong size");
        const values = new Float32Array(bytes.buffer);
        return docs.map((d) => {
          const start = offsets.get(d.text);
          return { ...d, vector: values.subarray(start, start + DIMENSIONS) };
        });
      })().catch((e) => { console.warn("Search index unavailable:", e.message); return null; });
    }
    return index;
  }

  // Best score per topic for one vector, best first
  function rank(docs, vector) {
    const best = new Map();
    docs.forEach((d) => {
      const key = d.topic.kind === "variable" ? d.topic.code : `missing${d.topic.index}`;
      const s = dot(vector, d.vector);
      if (!best.has(key) || s > best.get(key).score) best.set(key, { topic: d.topic, score: s, text: d.text });
    });
    return [...best.values()].sort((a, b) => b.score - a.score);
  }

  // Two topics that say nearly the same (a family, or a measurement and its satellite twin) don't
  // compete for the margin
  const related = (a, b) => a.family === b.family || (a.code && (a.code === b.pair || b.code === a.pair));

  // The question (place names already removed) -> { accepted, topic, score, margin, nearest, ranked }
  // or null when the model isn't available. Only an accepted match should be used.
  async function match(question, vars, notAvailable) {
    if (!question.trim()) return null;
    const [docs, vectors] = await Promise.all([prepare(vars, notAvailable), embed([question])])
      .catch((e) => { console.warn("Search by meaning failed:", e.message); return [null, null]; });
    if (!docs || !vectors) return null;
    const [q] = vectors;
    const ranked = rank(docs, q);
    const top = ranked[0];
    const rival = ranked.find((r) => !related(r.topic, top.topic));
    const margin = top.score - (rival ? rival.score : 0);
    const accepted = top.score >= ACCEPT && margin >= MARGIN;
    return { accepted, topic: top.topic, score: top.score, margin, nearest: top.text, ranked };
  }

  return { load, match, buildIndex, ACCEPT, MARGIN };
})();

if (typeof module !== "undefined") module.exports = ByteMeMeaning;
