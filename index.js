const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const port = process.env.PORT || 3000;

const APP_ID = 'ai-seek';
const PKG = 'ai.chatbot.ask.chat.deep.seek.assistant.search.free';
const VER = '2.9.4-26071777';

const uuidv7 = () => {
  const ts = BigInt(Date.now()).toString(16).padStart(12, '0');
  const rnd = crypto.randomBytes(10).toString('hex');
  return `${ts.slice(0, 8)}-${ts.slice(8, 12)}-7${rnd.slice(1, 4)}-${rnd.slice(4, 8)}-${rnd.slice(8, 20)}`;
};

const devInfo = (aid) => `appIdentifier=${PKG};appVersion=${VER};deviceType=android;deviceCountry=ID;appCountry=id;local=id_ID;language=id;timezone=Asia/Dhaka;brand=Infinix;model=Infinix%20X6833B;androidId=${aid}`;

async function newSession() {
  const aid = crypto.randomBytes(8).toString('hex');
  const sec = crypto.randomUUID();

  const { data } = await axios.post('https://saas.castbox.fm/auth/api/v1/tokens/provider/secret', { secret: sec }, {
    headers: {
      'User-Agent': 'Neo/1.0',
      'Content-Type': 'application/json',
      'x-app-id': APP_ID
    }
  });

  const token = data?.data?.token;
  const uid = data?.data?.uid;
  if (!token || !uid) throw new Error('auth failed');

  await axios.post('https://saas.castbox.fm/device/api/v1/devices', {
    androidId: aid,
    appIdentifier: PKG,
    appVersion: VER,
    brand: 'Infinix',
    deviceCountry: 'ID',
    deviceId: crypto.randomUUID(),
    deviceType: 'android',
    language: 'id',
    locale: 'id_ID',
    model: 'Neo X11',
    pushType: 'FCM',
    timezone: 'Asia/Dhaka',
    uid,
    deviceToken: 'dpCJFZRhTTmTk_OIFoAG1i:APA91bHr4X9Dg9RpFJvlo9Cd23-OwK2Q3ifFtu5UZ-5WQo5MvohowARyMpYuG4fdLWu9syjIKU9j97ra_V8sPzhkLvmTw3B38KRIvTZ-QHj42UjNRu9BAUo',
    firebaseAppInstanceId: crypto.randomBytes(16).toString('hex')
  }, {
    headers: {
      'User-Agent': 'Neo/1.0',
      'x-app-id': APP_ID,
      'x-device-info': devInfo(aid),
      'x-access-token': token,
      'Content-Type': 'application/json'
    }
  }).catch(() => {});

  return { token, aid, uid };
}

async function getImageToken(ext, auth) {
  const { data } = await axios.get(`https://ai-seek.thebetter.ai/v4/token/generate_image_token?count=1&extension=${ext}`, {
    headers: {
      'x-app-id': APP_ID,
      'x-device-info': devInfo(auth.aid),
      'x-access-token': auth.token,
      'User-Agent': 'Neo/1.0'
    }
  });
  const s3Key = data?.data?.imageS3KeyList?.[0];
  if (!s3Key) throw new Error('no s3 key');
  return s3Key;
}

async function downloadImage(url) {
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
  const buf = Buffer.from(res.data);
  const urlExt = path.extname(new URL(url).pathname).replace('.', '').toLowerCase();
  const ext = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(urlExt) ? urlExt : 'jpg';
  return { buf, ext };
}

async function uploadImage(buf, ext, auth) {
  const s3Key = await getImageToken(ext, auth);

  const { data } = await axios.post('https://ai-seek.thebetter.ai/v4/image/upload', {
    imageS3Key: s3Key
  }, {
    headers: {
      'x-app-id': APP_ID,
      'x-device-info': devInfo(auth.aid),
      'x-access-token': auth.token,
      'User-Agent': 'Neo/1.0',
      'Content-Type': 'application/json'
    }
  }).catch(() => ({}));

  const uploadUrl = data?.data?.uploadUrl || data?.data?.url;
  if (!uploadUrl) {
    return s3Key;
  }

  await axios.put(uploadUrl, buf, {
    headers: { 'Content-Type': 'application/octet-stream' },
    maxBodyLength: Infinity,
    maxContentLength: Infinity
  }).catch(() => {});

  return s3Key;
}

async function chat(prompt, auth, sessionId, model, imageUrl) {
  auth = auth || await newSession();
  sessionId = sessionId || uuidv7();

  const payload = {
    sessionId,
    userMessageId: uuidv7(),
    aiMessageId: uuidv7(),
    model: model || 'google/gemini-2.5-flash-lite',
    text: prompt,
    restrictedType: 'FREE_USER',
    sessionType: 'NORMAL'
  };

  if (imageUrl) {
    const { buf, ext } = await downloadImage(imageUrl);
    const s3Key = await uploadImage(buf, ext, auth);
    payload.imageS3Keys = [s3Key];
  }

  const stream = await axios.post('https://ai-seek.thebetter.ai/v4/chat/send', payload, {
    headers: {
      'Accept': 'text/event-stream',
      'Content-Type': 'application/json',
      'x-app-id': APP_ID,
      'x-device-info': devInfo(auth.aid),
      'x-access-token': auth.token,
      'User-Agent': 'Neo/1.0'
    },
    responseType: 'stream',
    timeout: 120000
  });

  return new Promise((resolve, reject) => {
    let text = '';
    let buf = '';

    stream.data.on('data', chunk => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop();

      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const s = t.slice(5).trim();
        if (!s || s === '[DONE]') continue;
        try {
          const p = JSON.parse(s);
          if (p.content) text += p.content;
        } catch (e) {}
      }
    });

    stream.data.on('end', () => resolve({ response: text.trim(), model: payload.model, sessionId }));
    stream.data.on('error', err => reject(err));
  });
}

const sessions = new Map();

app.get('/chat', async (req, res) => {
  try {
    const text = req.query.text;
    const imageUrl = req.query.vision || null;
    const model = req.query.model || 'google/gemini-2.5-flash-lite';
    const userChatId = req.query.chatid || crypto.randomUUID();

    if (!text) {
      return res.status(400).json({ status: 'error', message: 'missing text' });
    }

    let auth = null;
    let sessionId = null;

    const existing = sessions.get(userChatId);
    if (existing) {
      auth = existing.auth;
      sessionId = existing.sessionId;
    }

    let result;
    try {
      result = await chat(text, auth, sessionId, model, imageUrl);
    } catch (e) {
      auth = await newSession();
      sessionId = null;
      result = await chat(text, auth, sessionId, model, imageUrl);
    }

    sessions.set(userChatId, {
      auth,
      sessionId: result.sessionId
    });

    res.json({
      status: 'success',
      response: result.response,
      model: result.model,
      chatid: userChatId
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    usage: {
      chat: '/chat?text=hello&chatid=optional&model=optional',
      vision: '/chat?text=what is this&vision=https://example.com/img.jpg'
    }
  });
});

app.listen(port, () => {
  console.log(`server on ${port}`);
});
