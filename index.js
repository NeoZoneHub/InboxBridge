require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const express = require('express');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL = '@digitalcrew2';
const GROUP_LINK = 'https://t.me/Digtal_opt';
const ADMIN_ID = '6157845763';
const BASE_API = 'https://onlinesim.io/api/v1/free_numbers_content';
const LANG = '?lang=en';
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);

let activeNumbers = new Map();

bot.use(async (ctx, next) => {
  if (ctx.updateType === 'message') {
    try {
      const chatMember = await ctx.telegram.getChatMember(CHANNEL, ctx.from.id);
      if (['left', 'kicked'].includes(chatMember.status)) {
        return ctx.reply(`⚠️ Tu dois t'abonner à ${CHANNEL} pour utiliser le bot !\nClique ici: ${CHANNEL}`);
      }
    } catch { return ctx.reply('Erreur lors de la vérification de ton abonnement.'); }
  }
  return next();
});

bot.start(async (ctx) => {
  await ctx.reply(`👋 Salut ${ctx.from.first_name || ctx.from.username} !\nVoici comment utiliser le bot:\n\n` +
    `/number -> Choisis un pays et récupère un numéro virtuel\n` +
    `📤 Opt Groupe -> Les 5 derniers SMS du numéro seront envoyés dans le groupe`
  );
});

async function getOnlineCountries() {
  try {
    const res = await axios.get(`${BASE_API}/countries${LANG}`);
    if (res.data.response === '1') return res.data.counties.filter(c => c.online);
    return [];
  } catch { return []; }
}

async function getCountryNumbers(country) {
  try {
    const res = await axios.get(`${BASE_API}/countries/${country}${LANG}`);
    if (res.data.response === '1' && res.data.numbers) return res.data.numbers.map(n => ({ display: n.data_humans, full: n.full_number }));
    return [];
  } catch { return []; }
}

async function getNumberInbox(country, number) {
  try {
    const res = await axios.get(`${BASE_API}/countries/${country}/${number}${LANG}`);
    if (res.data.response === '1' && res.data.online && res.data.messages && res.data.messages.data) {
      return res.data.messages.data.map(m => ({ time: m.data_humans, text: m.text }));
    }
    return [];
  } catch { return []; }
}

bot.command('number', async (ctx) => {
  const countries = await getOnlineCountries();
  if (!countries.length) return ctx.reply('❌ Aucun pays en ligne.');
  const buttons = countries.map(c => Markup.button.callback(c.name.replace('_', ' '), `country_${c.name}`));
  await ctx.reply('🌍 Choisis un pays pour obtenir un numéro:', Markup.inlineKeyboard(buttons, { columns: 2 }));
});

bot.action(/country_(.+)/, async (ctx) => {
  const country = ctx.match[1];
  const numbers = await getCountryNumbers(country);
  if (!numbers.length) return ctx.reply('❌ Aucun numéro disponible pour ce pays.');

  const num = numbers[0];

  activeNumbers.set(num.full, { country, lastSentTime: 0 });

  await ctx.reply(`✅ Numéro virtuel pour ${country}: +${num.full}`, Markup.inlineKeyboard([
    Markup.button.url('📤 Opt Groupe', GROUP_LINK)
  ]));

  const inbox = await getNumberInbox(country, num.full);
  inbox.slice(0,5).forEach(m => ctx.telegram.sendMessage(GROUP_LINK, `📩 SMS de +${num.full} :\n${m.text}`));
  await ctx.telegram.sendMessage(ADMIN_ID, `🟢 ${ctx.from.first_name} a reçu le numéro: +${num.full}`);
});

setInterval(async () => {
  for (const [number, info] of activeNumbers) {
    const messages = await getNumberInbox(info.country, number);
    if (!messages.length) continue;
    const lastTime = info.lastSentTime;
    const newMessages = messages.filter(m => new Date(m.time).getTime() > lastTime);
    for (const msg of newMessages) {
      await bot.telegram.sendMessage(GROUP_LINK, `📩 SMS de +${number} :\n${msg.text}`);
      info.lastSentTime = new Date(msg.time).getTime();
      await new Promise(r => setTimeout(r, 10000));
    }
  }
}, 15000);

const app = express();
app.get('/', (req, res) => res.send('Bot Telegram actif !'));
app.listen(PORT, () => console.log(`Serveur HTTP actif sur le port ${PORT}`));

bot.launch().then(() => console.log('Bot démarré...')).catch(e => console.error(e));