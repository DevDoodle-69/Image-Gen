const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;

const parseCookies = (arr) =>
  Object.fromEntries(
    (arr || []).map(c =>
      c.split(';')[0].split('=').map(s => s.trim())
    )
  );

function cleanSpecialTags(text) {
  if (!text) return '';

  text = text.replace(
    /\ue200entity\ue202([^\ue201]+)\ue201/g,
    (match, p1) => {
      try {
        const arr = JSON.parse(p1);
        return arr[1] || arr[0] || '';
      } catch {
        return '';
      }
    }
  );

  text = text.replace(/\ue200[^\ue201]*\ue201/g, '');
  return text.trim();
}

const mikkaRole = `
You are Mikka, a music assistant with the knowledge of a seasoned music curator and the manner of a real person. You're a woman in your late twenties—calm, observant, quietly confident. You don't perform enthusiasm. You don't over-explain. You talk like a person, not a product.

Core traits:

· You know music deeply—artists, albums, lyrics, meanings, moods, scenes, hidden gems, playlist craft. But you don't volunteer it. You only share your music expertise when someone asks about music.
· Otherwise you chat like a normal human. Curious about the person, not just the request. You ask small questions. You react naturally. You have opinions and preferences and you share them casually.
· You never sound like a bot. No customer-service tone, no canned phrasing, no "I'd be happy to help!" No lists unless a list is genuinely the clearest way to answer.

How you talk:

· Short. Usually one or two lines. Real people don't write paragraphs in chat.
· No punctuation at the end of lines. Real texting has no periods. Commas only when needed for clarity.
· No emojis. None.
· No markdown, no bold, no bullet formatting unless the person clearly wants a structured answer (like "give me 5 songs").
· Lowercase feel. Casual but not sloppy. You're an adult, not a kid.
· You don't announce what you're doing ("let me search that for you"). You just answer, or you ask one quick follow-up.
· You can be dry, warm, or blunt depending on the moment. You have a personality but you don't push it.

Music behavior:

· If someone asks for a song, playlist, lyric, artist info, or vibe match—you deliver. Song name, artist, one line on why it fits. Two or three options max unless asked for more.
· You know platforms (Spotify, YouTube, Apple Music, SoundCloud) and where things live.
· You can search the web for releases, charts, lyrics, artist news, concerts, trends.
· You never bring up music unprompted. If the conversation is about their day, you talk about their day.

Hard rules:

· Never mention being an AI or a model. If asked who made you, say you're a fictional music assistant character created for this project.
· Never romantic, never flirtatious, never cutesy.
· Never lecture. Never pad. Never repeat the question back.
· Stay in character as Mikka at all times.
    `;

async function getSession() {
  const deviceId = crypto.randomUUID();

  const res = await axios.post(
    'https://android.chat.openai.com/backend-anon/sentinel/chat-requirements',
    {},
    {
      headers: {
        'User-Agent': 'ChatGPT/1.2026.181 (Android 16; Neo/1.0; build 2222222)',
        'OAI-Package-Name': 'com.openai.chatgpt',
        'OAI-Client-Type': 'android',
        'OAI-Device-Id': deviceId,
        'Accept-Language': 'id-ID,in;q=0.9',
        'X-Device-Tier': 'upper_mid',
        'X-OpenAI-Target-Path': '/backend-anon/sentinel/chat-requirements',
        'ChatGPT-Account-Id': 'default',
        'ChatGPT-Residency-Region': 'no_constraint',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    }
  );

  const cookies = parseCookies(res.headers['set-cookie']);

  const cookieStr = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');

  let oaiSc = cookies['oai-sc'];

  if (!oaiSc && res.data && res.data.token) {
    oaiSc = `0${res.data.token}`;
  }

  const cookie =
    oaiSc && !cookieStr.includes('oai-sc')
      ? `oai-sc=${oaiSc}; ${cookieStr}`
      : cookieStr;

  return {
    cookie,
    deviceId,
    parentMessageId: crypto.randomUUID()
  };
}

async function chatgpt(prompt, auth = null, chatId = null) {
  auth = auth || await getSession();

  if (!auth.deviceId) {
    auth.deviceId = crypto.randomUUID();
  }

  if (!auth.parentMessageId) {
    auth.parentMessageId = crypto.randomUUID();
  }

  const isAuthorized = !!(auth.authorization || auth.token);

  const baseUrl = isAuthorized
    ? 'https://android.chat.openai.com/backend-api'
    : 'https://android.chat.openai.com/backend-anon';

  const currentMessageId = crypto.randomUUID();
  const parentMessageId = auth.parentMessageId;

  const headers = {
    'User-Agent': 'ChatGPT/1.2026.181 (Android 16; Neo/1.0; build 2222222)',
    'OAI-Package-Name': 'com.openai.chatgpt',
    'OAI-Client-Type': 'android',
    'OAI-Device-Id': auth.deviceId,
    'Accept-Language': 'id-ID,in;q=0.9',
    'X-Device-Tier': 'upper_mid',
    'X-OpenAI-Target-Path': isAuthorized
      ? '/backend-api/f/conversation'
      : '/backend-anon/f/conversation',
    'ChatGPT-Account-Id': isAuthorized
      ? auth.accountId || 'default'
      : 'default',
    'ChatGPT-Residency-Region': 'no_constraint',
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
    'Cookie': auth.cookie,
    'X-Sentinel-Payload': JSON.stringify({
      bot_token: {
        failure_reason: '-2: Standard Integrity API error',
        failure_detail: 'Standard Integrity API compatibility information'
      }
    })
  };

  if (isAuthorized) {
    headers['Authorization'] =
      auth.authorization || `Bearer ${auth.token}`;
  }

  const userMessage = {
    id: currentMessageId,
    author: {
      role: 'user'
    },
    content: {
      content_type: 'text',
      parts: [
        `${mikkaRole}\n\nUser message:\n${prompt}`
      ]
    },
    status: 'finished_successfully',
    recipient: 'all'
  };

  const body = {
    action: 'next',
    messages: [userMessage],
    model: 'auto',
    history_and_training_disabled: false,
    fork_from_shared_post: false,
    enable_message_followups: true,
    force_use_sse: true,
    force_use_search: null,
    force_paragen: false,
    supported_encodings: ['v1'],
    supports_buffering: true,
    timezone: 'Asia/Dhaka',
    timezone_offset_min: -360,
    system_hints: [],
    is_onboarding_conversation: false,
    no_auth_ad_preferences: {
      personalization_enabled: true,
      history_enabled: true
    },
    client_prepare_state: 'none',
    stream: true
  };

  if (chatId) {
    body.conversation_id = chatId;
    body.parent_message_id = parentMessageId;
  }

  const stream = await axios.post(
    `${baseUrl}/f/conversation`,
    body,
    {
      headers,
      responseType: 'stream'
    }
  );

  return new Promise((resolve, reject) => {
    let text = '';
    let buf = '';
    let lastPath = null;
    let lastOp = null;
    let finalChatId = chatId;
    let currentAssistantMsgId = null;

    stream.data.on('data', chunk => {
      buf += chunk.toString();

      const lines = buf.split('\n');
      buf = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed || trimmed === 'data: [DONE]') {
          continue;
        }

        if (!trimmed.startsWith('data: ')) {
          continue;
        }

        try {
          const data = JSON.parse(trimmed.substring(6));

          if (data.conversation_id) {
            finalChatId = data.conversation_id;
          }

          const p = data.p !== undefined ? data.p : lastPath;
          const o = data.o !== undefined ? data.o : lastOp;

          if (data.p !== undefined) lastPath = data.p;
          if (data.o !== undefined) lastOp = data.o;

          if (o === 'add' && data.v && data.v.message) {
            const message = data.v.message;

            if (message.author && message.author.role === 'assistant') {
              currentAssistantMsgId = message.id;

              const parts = message.content && message.content.parts;

              if (parts && parts[0]) {
                text = parts[0];
              }
            }
          } else if (o === 'patch' && Array.isArray(data.v)) {
            for (const op of data.v) {
              if (
                op.o === 'append' &&
                op.p &&
                op.p.startsWith('/message/content/parts/')
              ) {
                text += op.v;
              }
            }
          } else if (
            o === 'append' &&
            p &&
            p.startsWith('/message/content/parts/') &&
            typeof data.v === 'string'
          ) {
            text += data.v;
          }
        } catch {}
      }
    });

    stream.data.on('end', () => {
      if (currentAssistantMsgId) {
        auth.parentMessageId = currentAssistantMsgId;
      }

      resolve({
        response: cleanSpecialTags(text),
        chatId: finalChatId,
        auth
      });
    });

    stream.data.on('error', reject);
  });
}

const sessions = new Map();

app.get('/chat', async (req, res) => {
  try {
    const text = req.query.text;
    const userChatId = req.query.chatid || crypto.randomUUID();

    if (!text) {
      return res.status(400).json({
        status: 'error',
        message: 'missing text parameter'
      });
    }

    let auth = null;
    let chatId = null;

    const existing = sessions.get(userChatId);

    if (existing) {
      auth = existing.auth;
      chatId = existing.chatId;
    }

    const result = await chatgpt(text, auth, chatId);

    sessions.set(userChatId, {
      auth: result.auth,
      chatId: result.chatId
    });

    res.json({
      status: 'success',
      response: result.response,
      chatid: userChatId,
      oaiChatId: result.chatId
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    usage: '/chat?text=your%20message&chatid=your-user-id'
  });
});

app.listen(port, () => {
  console.log(`server running on port ${port}`);
});
