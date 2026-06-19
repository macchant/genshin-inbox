/**
 * API Endpoint for Akasa Support System
 * Vercel Serverless Function with Supabase
 */

// Config
const CONFIG = {
  adminToken: process.env.ADMIN_TOKEN || 'akasa-admin-2026-secure',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramAdminChatId: process.env.TELEGRAM_ADMIN_ID || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_SERVICE_KEY || '' // Use service key for server-side
};

// Supabase fetch helper
async function supabaseFetch(endpoint, options = {}) {
  const res = await fetch(`${CONFIG.supabaseUrl}/rest/v1/${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'apikey': CONFIG.supabaseKey,
      'Authorization': `Bearer ${CONFIG.supabaseKey}`,
      'Prefer': 'return=representation',
      ...options.headers
    }
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(error);
  }
  return options.method === 'DELETE' ? null : res.json();
}

// Send Telegram notification (optional)
async function sendTelegramNotification(message) {
  if (!CONFIG.telegramBotToken || !CONFIG.telegramAdminChatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${CONFIG.telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CONFIG.telegramAdminChatId,
        text: message,
        parse_mode: 'HTML'
      })
    });
  } catch (error) {
    console.error('Telegram error:', error);
  }
}

// Main handler
module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { action, ...payload } = req.body || {};

  if (!action) {
    return res.status(400).json({ success: false, error: 'Action required' });
  }

  // Route actions
  try {
    switch (action) {
      case 'submit': {
        const { playerName, uid, message, contactMethod } = payload;

        // Validation
        if (!playerName || !playerName.trim()) {
          return res.status(400).json({ success: false, error: 'Player name is required' });
        }
        if (!uid || uid.length < 4 || uid.length > 20) {
          return res.status(400).json({ success: false, error: 'Invalid UID format' });
        }
        if (!message || !message.trim()) {
          return res.status(400).json({ success: false, error: 'Message is required' });
        }

        // Save to Supabase
        const newMessage = await supabaseFetch('messages', {
          method: 'POST',
          body: JSON.stringify({
            player_name: playerName.trim(),
            uid: uid.trim(),
            message: message.trim(),
            contact_method: contactMethod?.trim() || '',
            sender_type: 'web'
          })
        });

        const msg = Array.isArray(newMessage) ? newMessage[0] : newMessage;

        // Notify admin via Telegram
        if (CONFIG.telegramBotToken && CONFIG.telegramAdminChatId) {
          const tgMsg = `🌐 <b>New Support Request!</b>\n\n` +
            `👤 <b>Player:</b> ${msg.player_name}\n` +
            `🆔 <b>UID:</b> <code>${msg.uid}</code>\n\n` +
            `💬 <b>Message:</b>\n${msg.message}\n\n` +
            `📅 <b>Time:</b> ${new Date().toLocaleString()}\n` +
            `📎 <b>Ref:</b> <code>#${msg.id.slice(0, 8)}</code>`;

          // Send Telegram notification - await it properly
          try {
            const tgRes = await fetch(`https://api.telegram.org/bot${CONFIG.telegramBotToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: CONFIG.telegramAdminChatId,
                text: tgMsg,
                parse_mode: 'HTML'
              })
            });
            const tgData = await tgRes.json();
            console.log('Telegram response:', tgData);
            if (!tgData.ok) {
              console.error('Telegram error:', tgData.description);
            }
          } catch (e) {
            console.error('Telegram send error:', e);
          }
        }

        return res.status(200).json({
          success: true,
          refId: msg.id,
          message: 'Message sent successfully'
        });
      }

      case 'get_messages': {
        const { token } = payload;

        console.log('get_messages called, token:', token ? 'provided' : 'missing');
        console.log('Expected token:', CONFIG.adminToken);

        if (token !== CONFIG.adminToken) {
          return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        let url = 'messages?order=created_at.desc';
        const { status } = payload;
        if (status && status !== 'all') {
          url += `&status=eq.${status}`;
        }

        console.log('Fetching from:', `${CONFIG.supabaseUrl}/rest/v1/${url}`);
        const messages = await supabaseFetch(url);
        console.log('Messages returned:', messages?.length || 0);
        return res.status(200).json({ success: true, messages });
      }

      case 'get_messages_by_uid': {
        const { uid } = payload;

        if (!uid) {
          return res.status(400).json({ success: false, error: 'UID is required' });
        }

        const messages = await supabaseFetch(`messages?uid=eq.${uid}&order=created_at.desc`);
        return res.status(200).json({ success: true, messages });
      }

      case 'reply': {
        const { token, msg_id, reply } = payload;

        if (token !== CONFIG.adminToken) {
          return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        if (!msg_id || !reply) {
          return res.status(400).json({ success: false, error: 'Invalid parameters' });
        }

        const updated = await supabaseFetch(`messages?id=eq.${msg_id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            reply: reply.trim(),
            replied_by: 'admin',
            replied_at: new Date().toISOString(),
            status: 'replied'
          })
        });

        if (!updated || updated.length === 0) {
          return res.status(404).json({ success: false, error: 'Message not found' });
        }

        // Notify via Telegram
        if (CONFIG.telegramBotToken) {
          const tgMsg = `✅ <b>Reply Sent!</b>\n\n` +
            `📎 <b>Ref:</b> <code>#${msg_id.slice(0, 8)}</code>\n` +
            `💬 <b>Reply:</b>\n${reply}`;
          sendTelegramNotification(tgMsg);
        }

        return res.status(200).json({ success: true, message: 'Reply sent' });
      }

      case 'get_stats': {
        const { token } = payload;

        if (token !== CONFIG.adminToken) {
          return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const messages = await supabaseFetch('messages');
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const stats = {
          total: messages.length,
          pending: messages.filter(m => m.status === 'pending').length,
          replied: messages.filter(m => m.status === 'replied').length,
          resolved: messages.filter(m => m.status === 'resolved').length,
          today: messages.filter(m => m.created_at.startsWith(today)).length,
          week: messages.filter(m => m.created_at >= weekAgo).length
        };

        return res.status(200).json({ success: true, stats });
      }

      case 'resolve': {
        const { token, msg_id } = payload;

        if (token !== CONFIG.adminToken) {
          return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        await supabaseFetch(`messages?id=eq.${msg_id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'resolved' })
        });

        return res.status(200).json({ success: true });
      }

      default:
        return res.status(400).json({ success: false, error: 'Unknown action' });

      case 'test': {
        // Debug endpoint
        const results = {
          supabaseUrl: !!CONFIG.supabaseUrl,
          supabaseKey: !!CONFIG.supabaseKey,
          telegramToken: !!CONFIG.telegramBotToken,
          telegramChatId: !!CONFIG.telegramAdminChatId,
          adminToken: !!CONFIG.adminToken
        };

        // Try fetching messages
        try {
          const testMsg = await supabaseFetch('messages?select=*&limit=1');
          results.supabaseStatus = 'OK';
          results.messageCount = 'connected';
        } catch (e) {
          results.supabaseStatus = 'FAILED: ' + e.message;
        }

        // Try Telegram
        try {
          const botInfo = await fetch(`https://api.telegram.org/bot${CONFIG.telegramBotToken}/getMe`).then(r => r.json());
          results.telegramBot = botInfo.ok ? 'OK (@' + botInfo.result.username + ')' : 'FAILED';

          // Send test message
          const testMsg = await fetch(`https://api.telegram.org/bot${CONFIG.telegramBotToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: CONFIG.telegramAdminChatId,
              text: '🧪 <b>Test Message!</b>\n\nBot is working correctly!',
              parse_mode: 'HTML'
            })
          }).then(r => r.json());

          results.telegramSend = testMsg.ok ? 'OK - Check your Telegram!' : 'FAILED: ' + testMsg.description;
        } catch (e) {
          results.telegramSend = 'ERROR: ' + e.message;
        }

        return res.status(200).json(results);
      }
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};
