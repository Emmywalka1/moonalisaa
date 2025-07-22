// api/frame.js or pages/api/frame.js
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Basic frame response that redirects to your mini app
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta property="fc:frame" content="vNext" />
          <meta property="fc:frame:image" content="https://moonalisaa.vercel.app/preview.png" />
          <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
          <meta property="fc:frame:button:1" content="🚀 Launch MOONALISA Game" />
          <meta property="fc:frame:button:1:action" content="link" />
          <meta property="fc:frame:button:1:target" content="https://moonalisaa.vercel.app/" />
          
          <meta property="og:title" content="MOONALISA - Strategic Battle" />
          <meta property="og:description" content="Strategic Cow vs Grass tic-tac-toe game with balanced AI challenge!" />
          <meta property="og:image" content="https://moonalisaa.vercel.app/preview.png" />
        </head>
        <body>
          <h1>MOONALISA Game</h1>
          <p>Strategic Cow vs Grass Battle!</p>
        </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  } catch (error) {
    console.error('Frame API error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
