export default async function handler(req, res) {
  // Cabeçalhos CORS (igual antes)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const headers = {
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    // ... seus headers da API kimi ...
  };

  const { messages, stream = false, id } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Mensagens inválidas' });
  }

  try {
    let chatId = id;

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

    const resp = await fetch(`https://www.kimi.com/api/chat/${chatId}/completion/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ messages, temperature: 0.8, stream: true })
    });

    if (stream) {
      // Código para stream permanece igual
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
          } catch (e) {}
        }
      }

      res.end();

    } else {
      // AQUI o ajuste: em vez de ler como stream com getReader, use resp.text() para pegar tudo
      const textoCompleto = await resp.text();

      // A resposta vem em linhas 'data:' do SSE, vamos extrair os textos
      const linhas = textoCompleto.split('\n').filter(l => l.startsWith('data:'));
      let respostaFinal = '';

      for (const linha of linhas) {
        try {
          const json = JSON.parse(linha.replace(/^data:\s*/, ''));
          if (json.event === 'cmpl' && json.text) {
            respostaFinal += json.text;
          }
        } catch {}
      }

      return res.status(200).json({ id: chatId, content: respostaFinal });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao se conectar com a API do Kimi' });
  }
}
