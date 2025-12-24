import { MastraClient } from '@mastra/client-js';
import { weatherTool } from './tools/weather-tool';

const form = document.getElementById('form') as HTMLFormElement;
const resultEl = document.getElementById('result') as HTMLElement;
const submitBtn = document.getElementById('submit') as HTMLButtonElement;

function getClient() {
  return new MastraClient({ baseUrl: 'http://localhost:4111' });
}

type Tag = { id: string; value: string };
const tagInput = document.getElementById('tag-input') as HTMLInputElement;
const tagList = document.getElementById('tag-list') as HTMLDivElement;

let tags: Tag[] = [
  { id: crypto.randomUUID(), value: 'Beijing' },
  { id: crypto.randomUUID(), value: 'Shanghai' },
  { id: crypto.randomUUID(), value: 'Guangzhou' },
];

function renderTags() {
  tagList.innerHTML = '';
  for (const tag of tags) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'tag';
    el.textContent = tag.value;
    el.title = 'Remove';
    el.addEventListener('click', () => {
      tags = tags.filter((t) => t.id !== tag.id);
      renderTags();
    });
    tagList.appendChild(el);
  }
}

function addTag(raw: string) {
  const value = raw.trim();
  if (!value) return;
  if (tags.some((t) => t.value.toLowerCase() === value.toLowerCase())) return;
  tags.push({ id: crypto.randomUUID(), value });
  renderTags();
}

function clearResult() {
  resultEl.textContent = '';
}

renderTags();

tagInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addTag(tagInput.value);
    tagInput.value = '';
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  clearResult();
  resultEl.textContent = 'Streaming...\n';

  const locations = tags.map((t) => t.value);
  if (locations.length < 3) {
    resultEl.textContent = 'Please add at least 3 locations.';
    submitBtn.disabled = false;
    return;
  }

  const query = `Fetch the current weather for at least 3 locations and summarize the comparison:\n\nLocations: ${locations.join(
    ', ',
  )}\n\nRequirements:\n- Call the get-weather tool once per location (>= 3 tool calls)\n- Provide a short per-location bullet list (temp, feels-like, humidity, wind, conditions)\n- Provide a brief comparison summary and one practical suggestion`;

  try {
    const client = getClient();
    const agent = client.getAgent('multiWeatherAgent');
    const res = await agent.stream({
      messages: [{ role: 'user', content: query }],
      clientTools: { [weatherTool.id]: weatherTool },
    });

    let text = '';
    await res.processDataStream({
      onChunk: async (chunk) => {
        if (chunk.type === 'text-delta') {
          text += chunk.payload.text;
          resultEl.textContent = text;
        } else if (chunk.type === 'error') {
          resultEl.textContent = `Error: ${JSON.stringify(chunk.payload, null, 2)}`;
        }
      },
    });
  } catch (err: any) {
    resultEl.textContent = String(err?.message || err);
  } finally {
    submitBtn.disabled = false;
  }
});
