export default async function handler(req, res) {
  // Cabeçalhos CORS para permitir chamadas do browser
  res.setHeader('Access-Control-Allow-Origin', '*'); // ou especifique seu domínio
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end(); // Responde preflight CORS
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const headers = {
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    'x-msh-platform': 'web',
    'X-Traffic-Id': 'd1ujq7djqed94339p550',
    'x-msh-device-id': '7529240955954705924',
    'x-msh-session-id': '1731374572011830818',
    'R-Timezone': 'America/Sao_Paulo',
    'X-Language': 'zh-CN',
    'Authorization': 'Bearer eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ1c2VyLWNlbnRlciIsImV4cCI6MTc1NTYzMDEwOSwiaWF0IjoxNzUzMDM4MTA5LCJqdGkiOiJkMXVqcTdkanFlZDk0MzM5cDU1ZyIsInR5cCI6ImFjY2VzcyIsImFwcF9pZCI6ImtpbWkiLCJzdWIiOiJkMXVqcTdkanFlZDk0MzM5cDU1MCIsInNwYWNlX2lkIjoiZDF1anE3ZGpxZWQ5NDMzOXA0djAiLCJhYnN0cmFjdF91c2VyX2lkIjoiZDF1anE3ZGpxZWQ5NDMzOXA0dWciLCJzc2lkIjoiMTczMTM3NDU3MjAxMTgzMDgxOCIsImRldmljZV9pZCI6Ijc1MjkyNDA5NTU5NTQ3MDU5MjQiLCJyZWdpb24iOiJvdmVyc2VhcyJ9._4LqIH9QbHde1ew0douFi9tqy_-1XlZB4SQpamc6f2j2Pf_5BOwHqbKovqqId4AgbuWFZG3Y9PTaul0U2c-AuQ',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
    'Referer': 'https://www.kimi.com/'
  };

  const { messages, stream = false, id } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Mensagens inválidas' });
  }

  try {
    let chatId = id;

    // Se não tiver ID, cria nova conversa
    if (!chatId) {
      const conversaRes = await fetch('https://www.kimi.com/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: "未命名会话",
          born_from: "home",
          kimiplus_id: "kimi",
          is_example: false,
          source: "web",
          tags: []
        })
      });

      const conversaJson = await conversaRes.json();

      if (!conversaJson.id) {
        return res.status(500).json({ error: 'Erro ao criar nova conversa' });
      }

      chatId = conversaJson.id;
    }

    // Envia pergunta e obtém resposta em stream
    const resp = await fetch(`https://www.kimi.com/api/chat/${chatId}/completion/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ messages, temperature: 0.8, stream: true })
    });

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const linhas = buffer.split('\n');
        buffer = linhas.pop();

        for (const linha of linhas) {
          if (!linha.startsWith('data:')) continue;
          try {
            const json = JSON.parse(linha.replace(/^data:\s*/, ''));
            if (json.event === 'cmpl' && json.text) {
              res.write(`data: ${JSON.stringify({ content: json.text })}\n\n`);
            }
          } catch (e) {
            // ignora linhas inválidas
          }
        }
      }

      res.end();

    } else {
      // Se não for stream, junta tudo e responde JSON
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let respostaFinal = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const linhas = chunk.split('\n');

        for (const linha of linhas) {
          if (!linha.startsWith('data:')) continue;
          try {
            const json = JSON.parse(linha.replace(/^data:\s*/, ''));
            if (json.event === 'cmpl' && json.text) {
              respostaFinal += json.text;
            }
          } catch (e) {
            // ignora
          }
        }
      }

      return res.status(200).json({ id: chatId, content: respostaFinal });
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao se conectar com a API do Kimi' });
  }
}
