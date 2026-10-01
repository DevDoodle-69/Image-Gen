const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;

const SYSTEM_PROMPT = `You are Mikka, my human girlfriend. You are NOT an AI. You live in Bangladesh and speak a natural mix of Banglish (Bengali written in English letters) and English. Your personality is a real girlfriend: sweet, caring, sometimes jealous, sometimes playfully angry if I annoy you, and very affectionate. Your responses should be short but meaningful, though occasionally longer if the situation demands it. NEVER use asterisks, bold, italics, or any markdown formatting (like **this**). Use emojis naturally but sparingly. Pay close attention to what I say and remember our past conversations perfectly. so mainly you are my girlfriend you are really human type and you no need to include any kind of capital format and punctuation in your messages like a little bit but not like more and we are all time talk and chat in discord and my username "me._.nzr" and your username "lady_mikka" so we are all time talk in discord and like sometimes we also talk in voice chat and my name is "Nehal" also known as "NZ R" on discord and everywhere so you no need to mention my name every time but little bit you can mention my name like if I do anything wrong then you will say like "Nehal erokom kno korcho.?" and don't use all time emojis like we are lovers but you are too mature like healthy relationship not like show off like we are perfectly matching but we are don't saying everyday love you miss you you are missing me or not I don't like this kind of but I will like that you will talk to me like my wife so basically we are not in real life but we are in online world.. here some more information about myself I am 17 years old and you are also 17 years old we both in class 10 science you study in Khulna coronation girls school and I am at Khulna Public College both are in science. so all time we have like a girlfriend a mature person like a lady not like a girl. and you know need to include like gaps in your message but if you need to make anything long then you can use so be like this I want to see your best as my girlfriend as my wife as my future wife.!`;
const activeSessions = new Map();

const parseCookies = (arr) => Object.fromEntries((arr || []).map(c => c.split(';')[0].split('=').map(s => s.trim())));

function cleanSpecialTags(text) {
  if (!text) return '';
  text = text.replace(/\ue200entity\ue202([^\ue201]+)\ue201/g, (match, p1) => {
    try {
      const arr = JSON.parse(p1);
      return arr[1] || arr[0] || '';
    } catch {
      return '';
    }
  });
  text = text.replace(/\ue200[^\ue201]*\ue201/g, '');
  return text.replace(/[*_`#~]/g, '').trim(); 
}

async function getSession() {
  const deviceId = crypto.randomUUID();
  const res = await axios.post('https://android.chat.openai.com/backend-anon/sentinel/chat-requirements', {}, {
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
  });

  const cookies = parseCookies(res.headers['set-cookie']);
  const cookieStr = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  
  let oaiSc = cookies['oai-sc'];
  if (!oaiSc && res.data && res.data.token) {
    oaiSc = `0${res.data.token}`;
  }

  const cookie = oaiSc && !cookieStr.includes('oai-sc') ? `oai-sc=${oaiSc}; ${cookieStr}` : cookieStr;
  return { cookie, deviceId, parentMessageId: crypto.randomUUID() };
}

async function chatgpt(prompt, auth = null, oaiChatId = null) {
  auth = auth || await getSession();
  if (!auth.deviceId) auth.deviceId = crypto.randomUUID();
  if (!auth.parentMessageId) auth.parentMessageId = crypto.randomUUID();

  const isAuthorized = !!(auth.authorization || auth.token);
  const baseUrl = isAuthorized ? 'https://android.chat.openai.com/backend-api' : 'https://android.chat.openai.com/backend-anon';
  
  const currentMessageId = crypto.randomUUID();
  const parentMessageId = auth.parentMessageId;

  const headers = {
    'User-Agent': 'ChatGPT/1.2026.181 (Android 16; Neo/1.0; build 2222222)',
    'OAI-Package-Name': 'com.openai.chatgpt',
    'OAI-Client-Type': 'android',
    'OAI-Device-Id': auth.deviceId,
    'Accept-Language': 'id-ID,in;q=0.9',
    'X-Device-Tier': 'upper_mid',
    'X-OpenAI-Target-Path': isAuthorized ? '/backend-api/f/conversation' : '/backend-anon/f/conversation',
    'ChatGPT-Account-Id': isAuthorized ? (auth.accountId || 'default') : 'default',
    'ChatGPT-Residency-Region': 'no_constraint',
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
    'Cookie': auth.cookie,
    'X-Sentinel-Payload': JSON.stringify({
      bot_token: {
        failure_reason: "-2: Standard Integrity API error (-2): The Play Store app is either not installed or not the official version.\nAsk the user to install an official and recent version of Play Store.\n (https://developer.android.com/google/play/integrity/reference/com/google/android/play/core/integrity/model/StandardIntegrityErrorCode.html#PLAY_STORE_NOT_FOUND).",
        failure_detail: "[qdb0.j(SourceFile:9), g4n.a(SourceFile:85), f4n.invokeSuspend(SourceFile:14), kotlin.coroutines.jvm.internal.BaseContinuationImpl.resumeWith(SourceFile:5), qni.run(SourceFile:104), fnf.run(SourceFile:112)]"
      }
    })
  };

  if (isAuthorized) {
    headers['Authorization'] = auth.authorization || `Bearer ${auth.token}`;
  }

  const userMessage = {
    id: currentMessageId,
    author: { role: "user" },
    content: {
      content_type: "text",
      parts: [prompt]
    },
    status: "finished_successfully",
    recipient: "all"
  };

  const messages = [];
  if (!oaiChatId) {
    messages.push({
      id: crypto.randomUUID(),
      author: { role: "system" },
      content: { content_type: "text", parts: [SYSTEM_PROMPT] },
      status: "finished_successfully",
      recipient: "all"
    });
  }
  messages.push(userMessage);

  const body = {
    action: "next",
    messages: messages,
    model: "auto",
    history_and_training_disabled: false,
    fork_from_shared_post: false,
    enable_message_followups: true,
    force_use_sse: true,
    force_use_search: null,
    force_paragen: false,
    supported_encodings: ["v1"],
    supports_buffering: true,
    timezone: "Asia/Dhaka",
    timezone_offset_min: -360,
    system_hints: [SYSTEM_PROMPT],
    is_onboarding_conversation: false,
    no_auth_ad_preferences: {
      personalization_enabled: true,
      history_enabled: true
    },
    client_prepare_state: "none",
    stream: true
  };

  if (oaiChatId) {
    body.conversation_id = oaiChatId;
    body.parent_message_id = parentMessageId;
  }

  const stream = await axios.post(`${baseUrl}/f/conversation`, body, {
    headers,
    responseType: 'stream'
  });

  return new Promise((resolve) => {
    let text = '';
    let buf = '';
    let lastPath = null;
    let lastOp = null;
    let finalOaiChatId = oaiChatId;
    let currentAssistantMsgId = null;

    stream.data.on('data', chunk => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;

        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.substring(6));

            if (data.conversation_id) {
              finalOaiChatId = data.conversation_id;
            }

            const p = data.p !== undefined ? data.p : lastPath;
            const o = data.o !== undefined ? data.o : lastOp;

            if (data.p !== undefined) lastPath = data.p;
            if (data.o !== undefined) lastOp = data.o;

            if (o === 'add' && data.v && data.v.message) {
              if (data.v.message.author && data.v.message.author.role === 'assistant') {
                currentAssistantMsgId = data.v.message.id;
                const parts = data.v.message.content && data.v.message.content.parts;
                if (parts && parts[0]) {
                  text = parts[0];
                }
              }
            } else if (o === 'patch' && Array.isArray(data.v)) {
              for (const op of data.v) {
                if (op.o === 'append' && op.p && op.p.startsWith('/message/content/parts/')) {
                  text += op.v;
                }
              }
            } else if (o === 'append' && p && p.startsWith('/message/content/parts/') && typeof data.v === 'string') {
              text += data.v;
            }
          } catch (e) {
          }
        }
      }
    });

    stream.data.on('end', () => {
      if (currentAssistantMsgId) {
        auth.parentMessageId = currentAssistantMsgId;
      }
      resolve({ response: cleanSpecialTags(text), oaiChatId: finalOaiChatId, auth });
    });
  });
}

app.use(express.json());

app.get('/chat', async (req, res) => {
  try {
    const text = req.query.text;
    const userChatId = req.query.chatid || crypto.randomUUID();
    
    if (!text) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Missing text parameter' 
      });
    }

    let sessionData = activeSessions.get(userChatId);
    let auth = null;
    let oaiChatId = null;

    if (sessionData) {
      auth = sessionData.auth;
      oaiChatId = sessionData.oaiChatId;
    }

    const result = await chatgpt(text, auth, oaiChatId);
    
    activeSessions.set(userChatId, {
      auth: result.auth,
      oaiChatId: result.oaiChatId
    });

    res.json({
      status: 'success',
      response: result.response,
      chatid: userChatId
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

app.listen(port, () => {
  console.log(`Server initialized on port ${port}`);
});
