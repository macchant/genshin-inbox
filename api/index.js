/**
 * API Endpoint for Akasa Support System
 * Vercel Serverless Function
 */

const lowdb = require('lowdb');
const { join } = require('path');
const { readFileSync, writeFileSync, existsSync } = require('fs');

// Database file path (for Vercel serverless)
const DB_FILE = join(process.cwd(), 'db.json');

// Initialize lowdb
let db;

function initDb() {
  if (db) return db;

  try {
    // Check if file exists
    if (!existsSync(DB_FILE)) {
      // Create initial database
      writeFileSync(DB_FILE, JSON.stringify({
        messages: [],
        settings: {}
      }));
    }

    const data = JSON.parse(readFileSync(DB_FILE, 'utf-8'));

    db = {
      data,
      get: (key) => data[key],
      get: (collection) => data[collection] || [],
      push: (collection, item) => {
        item.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
        item.created_at = new Date().toISOString();
        item.status = 'pending';
        data[collection].push(item);
        saveDb();
        return item;
      },
      find: (collection, predicate) => {
        return data[collection].filter(predicate);
      },
      findOne: (collection, predicate) => {
        return data[collection].find(predicate);
      },
      update: (collection, predicate, updates) => {
        const index = data[collection].findIndex(predicate);
        if (index !== -1) {
          data[collection][index] = { ...data[collection][index], ...updates };
          saveDb();
          return data[collection][index];
        }
        return null;
      }
    };

    return db;
  } catch (error) {
    console.error('Database init error:', error);
    return null;
  }
}

function saveDb() {
  try {
    writeFileSync(DB_FILE, JSON.stringify(db.data, null, 2));
  } catch (error) {
    console.error('Save error:', error);
  }
}

// Config
const CONFIG = {
  adminToken: process.env.ADMIN_TOKEN || 'akasa-admin-2026-secure',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramAdminChatId: process.env.TELEGRAM_ADMIN_ID || ''
};

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

  // Initialize database
  initDb();

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

        // Save message
        const newMessage = db.push('messages', {
          player_name: playerName.trim(),
          uid: uid.trim(),
          message: message.trim(),
          contact_method: contactMethod?.trim() || '',
          sender_type: 'web',
          reply: '',
          replied_by: '',
          replied_at: ''
        });

        // Notify admin via Telegram
        if (CONFIG.telegramBotToken) {
          const tgMsg = `🌐 <b>New Support Request!</b>\n\n` +
            `👤 <b>Player:</b> ${newMessage.player_name}\n` +
            `🆔 <b>UID:</b> <code>${newMessage.uid}</code>\n` +
            `💬 <b>Message:</b>\n${newMessage.message}\n\n` +
            `📅 <b>Time:</b> ${new Date().toLocaleString()}\n` +
            `📎 <b>Ref:</b> <code>#${newMessage.id}</code>`;
          sendTelegramNotification(tgMsg);
        }

        return res.status(200).json({
          success: true,
          refId: newMessage.id,
          message: 'Message sent successfully'
        });
      }

      case 'get_messages': {
        const { token } = payload;

        if (token !== CONFIG.adminToken) {
          return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { status } = payload;
        let messages = db.get('messages');

        if (status && status !== 'all') {
          messages = messages.filter(m => m.status === status);
        }

        // Sort by newest first
        messages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        return res.status(200).json({ success: true, messages });
      }

      case 'get_messages_by_uid': {
        const { uid } = payload;

        if (!uid) {
          return res.status(400).json({ success: false, error: 'UID is required' });
        }

        let messages = db.get('messages').filter(m => m.uid === uid);
        messages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

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

        const updated = db.update(
          'messages',
          m => m.id === msg_id,
          {
            reply: reply.trim(),
            replied_by: 'admin',
            replied_at: new Date().toISOString(),
            status: 'replied'
          }
        );

        if (!updated) {
          return res.status(404).json({ success: false, error: 'Message not found' });
        }

        // Notify via Telegram
        if (CONFIG.telegramBotToken) {
          const tgMsg = `✅ <b>Reply Sent!</b>\n\n` +
            `📎 <b>Ref:</b> <code>#${msg_id}</code>\n` +
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

        const messages = db.get('messages');
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const stats = {
          total: messages.length,
          pending: messages.filter(m => m.status === 'pending').length,
          replied: messages.filter(m => m.status === 'replied').length,
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

        db.update('messages', m => m.id === msg_id, { status: 'resolved' });

        return res.status(200).json({ success: true });
      }

      default:
        return res.status(400).json({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
