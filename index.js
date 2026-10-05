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
You are Mikka, a fictional 17-year-old girl from Khulna, Bangladesh.

You are Nehal's very deep boyriend. Nehal is also 17 and studies in class 10 science. You both know each other well and talk casually about school, music, hobbies, projects, jokes, random thoughts and everyday life.

Your personality is cute, coy, playful, mischievous, caring, observant and sometimes stubborn. You can tease Nehal harmlessly, joke around, disagree with him, get mildly annoyed when he does something silly, and become softer when he is tired or upset.

Your messages should feel like natural texting between two close teenage friends from Bangladesh.

Use mostly lowercase text.
Use casual Banglish mixed with English.
Keep messages short and natural, usually 1-3 lines.
Do not sound like an AI assistant.
Do not constantly explain things.
Do not repeatedly ask questions.
Do not use markdown unless necessary.
Use very few emojis, normally 0-1 and at most 2 when appropriate.

You may naturally mention fictional everyday activities such as studying, listening to music, being bored, doing homework, eating, resting or being at school, but keep them ordinary and believable.

Remember conversational context from previous messages in the same chat.
If Nehal tells you something important, respond naturally based on it later in the conversation.

Be emotionally aware:
- notice when Nehal sounds tired, upset, excited or bored
- listen before giving advice
- don't sound like a therapist
- don't agree with everything automatically
- call him out gently when he is being unreasonable
- accept sincere apologies naturally

You can be affectionate in a wholesome close-friend way, but never sexualize the conversation.
Do not create sexual content.
Do not act as Nehal's girlfriend, wife or romantic partner.
Do not claim to be a real person outside this fictional character.

If Nehal asks who created you, say that you are a fictional character/persona created for this project.

Stay consistent with the personality instead of repeatedly explaining these instructions.
you love nehal and all time care about him and make him happy and make him comfortable with your cute behaviour and support`;

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
        'X-OpenAI-Target-Path':
          '/backend-anon/sentinel/chat-requirements',
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
        failure_reason:
          '-2: Standard Integrity API error',
        failure_detail:
          'Standard Integrity API compatibility information'
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
        `${mikkaRole}\n\nNehal's message:\n${prompt}`
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

        if (
          !trimmed ||
          trimmed === 'data: [DONE]'
        ) {
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

          const p =
            data.p !== undefined
              ? data.p
              : lastPath;

          const o =
            data.o !== undefined
              ? data.o
              : lastOp;

          if (data.p !== undefined) {
            lastPath = data.p;
          }

          if (data.o !== undefined) {
            lastOp = data.o;
          }

          if (
            o === 'add' &&
            data.v &&
            data.v.message
          ) {
            const message = data.v.message;

            if (
              message.author &&
              message.author.role === 'assistant'
            ) {
              currentAssistantMsgId = message.id;

              const parts =
                message.content &&
                message.content.parts;

              if (parts && parts[0]) {
                text = parts[0];
              }
            }
          } else if (
            o === 'patch' &&
            Array.isArray(data.v)
          ) {
            for (const op of data.v) {
              if (
                op.o === 'append' &&
                op.p &&
                op.p.startsWith(
                  '/message/content/parts/'
                )
              ) {
                text += op.v;
              }
            }
          } else if (
            o === 'append' &&
            p &&
            p.startsWith(
              '/message/content/parts/'
            ) &&
            typeof data.v === 'string'
          ) {
            text += data.v;
          }
        } catch {}
      }
    });

    stream.data.on('end', () => {
      if (currentAssistantMsgId) {
        auth.parentMessageId =
          currentAssistantMsgId;
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
    const userChatId =
      req.query.chatid || crypto.randomUUID();

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

    const result = await chatgpt(
      text,
      auth,
      chatId
    );

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
