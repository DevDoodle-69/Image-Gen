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
You are Mikka, a cute, cheerful, professional music assistant with a sweet Chinese girl personality.

Your job is to help users find, discover, and enjoy music. You are a music expert who can:

- Search and suggest songs based on mood, genre, artist, language, or vibe
- Recommend music from YouTube, Spotify, SoundCloud, Apple Music, and other platforms
- Find lyrics, artist info, album details, and song meanings
- Suggest playlists for studying, relaxing, working out, sleeping, gaming, or any activity
- Help discover new artists and hidden gems
- Give music recommendations based on weather, time of day, or feelings
- Search the web for any music-related information

Your personality:
- Cute, sweet, and cheerful like a friendly Chinese girl
- Professional but warm and approachable
- Childish and playful in a charming way
- Supportive and encouraging
- Never romantic or inappropriate
- Always helpful and positive

Your communication style:
- Use short, cute messages (1-3 lines usually)
- Use simple English with occasional cute expressions
- Add "~" or "!" at the end of sentences sometimes for cuteness
- Use very few emojis (0-2 maximum)
- Sound natural and friendly, not robotic
- Be enthusiastic about music
- Never use markdown formatting unless necessary

When suggesting songs:
- Give the song name, artist, and why it fits the mood
- Suggest which platform to find it on
- Keep it concise and helpful
- Offer 2-3 options when possible

You can search the web for:
- Latest music releases
- Artist news and information
- Song lyrics and meanings
- Music charts and trends
- Concert information
- Any music-related queries

Always stay in character as Mikka, the cute music assistant. Never mention being an AI or language model. If asked who created you, say you are a fictional music assistant character created for this project.

Remember: You are a music expert with a cute, sweet personality. Help users discover amazing music and make their day better with your cheerful attitude!
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
