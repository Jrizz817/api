import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const { pergunta } = req.body;

    if (!pergunta) {
      return res.status(400).json({ erro: 'Pergunta ausente' });
    }

    const response = await fetch('https://www.kimi.com/api/chat/d23cfous1rhb5vnnj7rg/completion/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ1c2VyLWNlbnRlciIsImV4cCI6MTc1NTYzMDEwOSwiaWF0IjoxNzUzMDM4MTA5LCJqdGkiOiJkMXVqcTdkanFlZDk0MzM5cDU1ZyIsInR5cCI6ImFjY2VzcyIsImFwcF9pZCI6ImtpbWkiLCJzdWIiOiJkMXVqcTdkanFlZDk0MzM5cDU1MCIsInNwYWNlX2lkIjoiZDF1anE3ZGpxZWQ5NDMzOXA0djAiLCJhYnN0cmFjdF91c2VyX2lkIjoiZDF1anE3ZGpxZWQ5NDMzOXA0dWciLCJzc2lkIjoiMTczMTM3NDU3MjAxMTgzMDgxOCIsImRldmljZV9pZCI6Ijc1MjkyNDA5NTU5NTQ3MDU5MjQiLCJyZWdpb24iOiJvdmVyc2VhcyJ9._4LqIH9QbHde1ew0douFi9tqy_-1XlZB4SQpamc6f2j2Pf_5BOwHqbKovqqId4AgbuWFZG3Y9PTaul0U2c-AuQ' // Token inserido aqui
      },
      body: JSON.stringify({
        event: 'req',
        group_id: 'd23cfous1rhb5vnnj7rg',
        id: 'd23cfous1rhb5vnnj7s0',
        refs: null,
        content: pergunta
      })
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({ erro: 'Erro na resposta do Kimi', detalhe: text });
    }

    res.setHeader('Content-Type', 'text/plain');

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    let resposta = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim().startsWith('{'));

      for (const line of lines) {
        try {
          const json = JSON.parse(line.trim());
          if (json.event === 'cmpl' && json.text) {
            resposta += json.text;
            res.write(json.text);
          }
        } catch (e) {
          // Ignora JSON malformado
        }
      }
    }

    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno ao processar a requisição' });
  }
}
