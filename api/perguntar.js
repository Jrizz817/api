import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Apenas POST permitido' });
  }

  const { pergunta } = req.body;
  if (!pergunta) {
    return res.status(400).json({ erro: 'Pergunta ausente' });
  }

  const HEADERS = {
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

  try {
    // 1. Criar nova conversa
    const criar = await fetch('https://www.kimi.com/api/chat', {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        name: "未命名会话",
        born_from: "home",
        kimiplus_id: "kimi",
        is_example: false,
        source: "web",
        tags: []
      })
    });

    const dados = await criar.json();
    const id = dados.id;

    // 2. Enviar mensagem via stream
    const completion = await fetch(`https://www.kimi.com/api/chat/${id}/completion/stream`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        messages: [{ role: "user", content: pergunta }],
        temperature: 0.8,
        stream: true
      })
    });

    const reader = completion.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let respostaFinal = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const linhas = buffer.split('\n');
      buffer = linhas.pop(); // mantém resto se estiver incompleto

      for (const linha of linhas) {
        if (!linha.startsWith('data:')) continue;

        try {
          const json = JSON.parse(linha.replace(/^data:\s*/, ''));
          if (json.event === 'cmpl' && json.text) {
            respostaFinal += json.text;
          }
        } catch (e) {
          console.warn('Erro ao processar linha:', linha);
        }
      }
    }

    res.status(200).json({ resposta: respostaFinal });

  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno ao processar a requisição' });
  }
}
