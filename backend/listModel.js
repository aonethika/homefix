const res = await fetch(
  'https://generativelanguage.googleapis.com/v1beta/models?key=' + process.env.LLM_API_KEY
);
const data = await res.json();
for (const m of data.models ?? []) {
  if (m.supportedGenerationMethods?.includes('generateContent')) console.log(m.name);
}