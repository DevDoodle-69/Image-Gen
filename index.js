const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const port = 3000;

const MODELS = ['flux-schnell', 'imagen-3-fast', 'imagen-3', 'recraft-v3'];
const RATIOS = ['1:1', '16:9', '9:16', '3:2', '4:3', '5:4'];

app.use(express.static('public'));

const generateImage = async (prompt, model, ratio) => {
    const url = 'https://www.pixelmuse.studio/api/predictions';
    
    const headers = {
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/json',
        'origin': 'https://www.pixelmuse.studio',
        'referer': 'https://www.pixelmuse.studio/',
        'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
    };

    const payload = {
        prompt,
        model,
        style: 'none',
        aspect_ratio: ratio
    };

    try {
        const response = await axios.post(url, payload, { headers });
        return response.data;
    } catch (error) {
        throw error;
    }
};

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname,'index.html'));
});

app.get('/image', async (req, res) => {
    const { prompt, model, ratio } = req.query;
    
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    const selectedModel = MODELS[parseInt(model) - 1] || MODELS[0];
    const selectedRatio = RATIOS[parseInt(ratio) - 1] || RATIOS[0];

    try {
        const result = await generateImage(prompt, selectedModel, selectedRatio);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate image' });
    }
});

app.listen(port, () => console.log(`Server running on port ${port}`));
