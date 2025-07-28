import fetch from 'node-fetch';

const KIMI_API_URL = 'https://www.kimi.com/api';
const TOKEN = 'eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ1c2VyLWNlbnRlciIsImV4cCI6MTc1NTYzMDEwOSwiaWF0IjoxNzUzMDM4MTA5LCJqdGkiOiJkMXVqcTdkanFlZDk0MzM5cDU1ZyIsInR5cCI6ImFjY2VzcyIsImFwcF9pZCI6ImtpbWkiLCJzdWIiOiJkMXVqcTdkanFlZDk0MzM5cDU1MCIsInNwYWNlX2lkIjoiZDF1anE3ZGpxZWQ5NDMzOXA0djAiLCJhYnN0cmFjdF91c2VyX2lkIjoiZDF1anE3ZGpxZWQ5NDMzOXA0dWciLCJzc2lkIjoiMTczMTM3NDU3MjAxMTgzMDgxOCIsImRldmljZV9pZCI6Ijc1MjkyNDA5NTU5NTQ3MDU5MjQiLCJyZWdpb24iOiJvdmVyc2VhcyJ9._4LqIH9QbHde1ew0douFi9tqy_-1XlZB4SQpamc6f2j2Pf_5BOwHqbKovqqId4AgbuWFZG3Y9PTaul0U2c-AuQ';

const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json, text/plain, */*',
  'x-msh-platform': 'web',
  'X-Traffic-Id': 'd1ujq7djqed94339p550',
  'x-msh-device-id': '7529240955954705924',
  'x-msh-session-id': '1731374572011830818',
  'R-Timezone': 'America/Sao_Paulo',
  'X-Language': 'en-US',
  'User-Agent': 'node-fetch',
  'Referer': 'https://www.kimi.com/',
  'Authorization': `Bearer ${TOKEN}`
};

async function criarConversa() {
  const resp = await fetch(`${KIMI_API_URL}/chat`, {
    method: 'POST',
    headers: COMMON_HEADERS,
    body: JSON.stringify({
      name: "Unnamed Chat",
      born_from: "home",
      kimiplus_id: "kimi",
      is_example: false,
      source: "web",
      tags: []
    })
  });
  if (!resp.ok) throw new Error(`Erro ao criar conversa: ${resp.status}`);
  const data = await resp.json();
  if (!data.id) throw new Error('Resposta sem id da conversa');
  return data.id;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  try {
    const { model, messages, temperature, chatId, stream = false } = req.body;

    if (!model || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Campos obrigatórios: model, messages (array)' });
    }

    let idConversa = chatId;
    let novoChatCriado = false;

    if (!idConversa) {
      idConversa = await criarConversa();
      novoChatCriado = true;
    }

    const bodyKimi = {
      model,
      messages,
      temperature: temperature ?? 0.8,
      stream
    };

    const resp = await fetch(`${KIMI_API_URL}/chat/${idConversa}/completion/stream`, {
      method: 'POST',
      headers: {
        ...COMMON_HEADERS,
        'Accept': stream ? 'text/event-stream, application/json' : 'application/json'
      },
      body: JSON.stringify(bodyKimi)
    });

    if (!resp.ok) {
      return res.status(resp.status).json({ error: 'Erro na API Kimi', status: resp.status });
    }

    if (!stream) {
      // Stream OFF: lê JSON puro direto
      const data = await resp.json();
      const responsePayload = { response: data.text || data.answer || JSON.stringify(data) };
      if (novoChatCriado) responsePayload.chatId = idConversa;
      return res.status(200).json(responsePayload);
    } else {
      // Stream ON: lê SSE manualmente no Node.js
      return new Promise((resolve, reject) => {
        let respostaBot = '';
        let buffer = '';

        resp.body.on('data', (chunk) => {
          buffer += chunk.toString();
          const linhas = buffer.split('\n');
          buffer = linhas.pop();

          for (const linha of linhas) {
            if (!linha.startsWith('data:')) continue;
            const jsonStr = linha.replace(/^data:\s*/, '');
            if (jsonStr === '[DONE]') {
              const responsePayload = { response: respostaBot.trim() };
              if (novoChatCriado) responsePayload.chatId = idConversa;
              res.status(200).json(responsePayload);
              resolve();
              return;
            }
            try {
              const json = JSON.parse(jsonStr);
              if (json.event === 'cmpl' && json.text) {
                respostaBot += json.text;
              }
              if (json.event === 'error') {
                res.status(500).json({ error: json.message || 'Erro desconhecido da API Kimi' });
                reject(new Error(json.message));
                return;
              }
            } catch {
              // ignora erros JSON
            }
          }
        });

        resp.body.on('end', () => {
          if (!res.writableEnded) {
            const responsePayload = { response: respostaBot.trim() };
            if (novoChatCriado) responsePayload.chatId = idConversa;
            res.status(200).json(responsePayload);
            resolve();
          }
        });

        resp.body.on('error', (err) => {
          if (!res.writableEnded) {
            res.status(500).json({ error: err.message || 'Erro no stream' });
          }
          reject(err);
        });
      });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Erro interno' });
  }
}
