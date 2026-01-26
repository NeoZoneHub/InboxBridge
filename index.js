require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const express = require('express');

const BOT_TOKEN = process.env.BOT_TOKEN || '8301824678:AAFdeWjozDImkKHsYAhdtwr1LJJgrt7xMh8';
const CHANNEL = '@digitalcrew2';
const GROUP_ID = '-1003575360854';
const ADMIN_ID = '6157845763';
const BASE_API = 'https://onlinesim.io/api/v1/free_numbers_content';
const LANG = '?lang=en';
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);

// --- Middleware abonnement ---
bot.use(async (ctx, next) => {
  if (ctx.updateType === 'message') {
    try {
      const chatMember = await ctx.telegram.getChatMember(CHANNEL, ctx.from.id);
      if (['left', 'kicked'].includes(chatMember.status)) {
        return ctx.reply(
          `⚠️ Tu dois t'abonner à ${CHANNEL} pour utiliser le bot !\n` +
          `Clique ici pour t'abonner: ${CHANNEL}`
        );
      }
    } catch (err) {
      console.log('Erreur vérification abonnement:', err);
      return ctx.reply('Erreur lors de la vérification de ton abonnement.');
    }
  }
  return next();
});

// --- Start ---
bot.start(async (ctx) => {
  await ctx.reply(`👋 Salut ${ctx.from.first_name || ctx.from.username} !\nTu peux maintenant utiliser le bot.`);
});

// --- Fonctions numéros virtuels ---
async function getOnlineCountries() {
  try {
    const res = await axios.get(`${BASE_API}/countries${LANG}`);
    if (res.data.response === '1') {
      return res.data.counties.filter(c => c.online);
    }
    return [];
  } catch (err) {
    console.log('Erreur getOnlineCountries:', err);
    return [];
  }
}

async function getCountryNumbers(country) {
  try {
    const res = await axios.get(`${BASE_API}/countries/${country}${LANG}`);
    if (res.data.response === '1') {
      return res.data.numbers.map(n => ({
        display: n.data_humans,
        full: n.full_number
      }));
    }
    return [];
  } catch (err) {
    console.log('Erreur getCountryNumbers:', err);
    return [];
  }
}

async function getNumberInbox(country, number) {
  try {
    const res = await axios.get(`${BASE_API}/countries/${country}/${number}${LANG}`);
    if (res.data.response === '1' && res.data.online) {
      return res.data.messages.data.map(m => ({ time: m.data_humans, text: m.text }));
    }
    return [];
  } catch (err) {
    console.log('Erreur getNumberInbox:', err);
    return [];
  }
}

// --- Commande /number ---
bot.command('number', async (ctx) => {
  const prompt = await ctx.reply('📲 Récupération d’un numéro virtuel...');
  const countries = await getOnlineCountries();

  if (!countries.length) {
    return ctx.telegram.editMessageText(ctx.chat.id, prompt.message_id, null, '❌ Aucun pays en ligne pour l’instant.');
  }

  let found = false;
  for (let country of countries) {
    const numbers = await getCountryNumbers(country.name);
    for (let num of numbers) {
      const inbox = await getNumberInbox(country.name, num.full);
      if (inbox.length) {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          prompt.message_id,
          null,
          `✅ Voici ton numéro virtuel : +${num.full} (${country.name})`,
          Markup.inlineKeyboard([
            Markup.button.callback('📨 Inbox', `inbox_${country.name}_${num.full}`),
            Markup.button.callback('🔄 Nouveau numéro', `new_number`)
          ])
        );

        inbox.slice(-5).forEach(async m => {
          await ctx.telegram.sendMessage(GROUP_ID, `📩 SMS de +${num.full} :\n${m.text}`);
        });

        await ctx.telegram.sendMessage(ADMIN_ID, `🟢 ${ctx.from.first_name} a reçu le numéro: +${num.full}`);
        found = true;
        break;
      }
    }
    if (found) break;
  }

  if (!found) {
    await ctx.telegram.editMessageText(ctx.chat.id, prompt.message_id, null, '❌ Aucun numéro actif trouvé pour l’instant.');
  }
});

// --- Callbacks Inbox & Nouveau numéro ---
bot.action(/inbox_(.+)_(.+)/, async (ctx) => {
  const [country, number] = ctx.match.slice(1);
  const messages = await getNumberInbox(country, number);
  if (!messages.length) return ctx.reply('📭 Pas de message pour ce numéro.');
  messages.slice(-5).forEach(m => ctx.reply(`📩 [${m.time}] ${m.text}`));
});

bot.action('new_number', async (ctx) => {
  await ctx.reply('🔄 Récupération d’un nouveau numéro...');
  await bot.telegram.sendMessage(ctx.from.id, '/number');
});

// --- Serveur HTTP minimal pour Render ---
const app = express();
app.get('/', (req, res) => res.send('Bot Telegram actif !'));
app.listen(PORT, () => console.log(`Serveur HTTP actif sur le port ${PORT}`));

// --- Lancement du bot Telegram ---
bot.launch();
console.log('Bot démarré...');