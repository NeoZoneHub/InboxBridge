require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL = '@digitalcrew2';        
const GROUP_ID = '-1003575360854';      
const ADMIN_ID = '6157845763';          
const NUM_API = process.env.NUM_API;     // L'API pour les numéros virtuels

const bot = new Telegraf(BOT_TOKEN);

// Middleware pour vérifier l'abonnement
bot.use(async (ctx, next) => {
  if (ctx.updateType === 'message') {
    try {
      const chatMember = await ctx.telegram.getChatMember(CHANNEL, ctx.from.id);
      if (['left', 'kicked'].includes(chatMember.status)) {
        return ctx.reply(
          `⚠️ Tu dois t'abonner à ${CHANNEL} pour utiliser ce bot !\n` +
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

// Commande start
bot.start(async (ctx) => {
  await ctx.reply(
    `👋 Salut ${ctx.from.first_name || ctx.from.username} !\n` +
    `Tu es maintenant autorisé à utiliser le bot.`
  );
});

// Fonction pour récupérer un numéro virtuel
async function getVirtualNumber() {
  try {
    const res = await axios.get(`${NUM_API}/get_number`); // Ex: l'endpoint de ton API
    if (res.data && res.data.number) {
      return res.data; // { number: "123456789", country: "Russia", messages: [...] }
    }
    return null;
  } catch (err) {
    console.log('Erreur récupération numéro virtuel:', err);
    return null;
  }
}

// Commande pour obtenir un numéro
bot.command('number', async (ctx) => {
  const prompt = await ctx.reply('📲 Récupération d’un numéro virtuel en cours...');
  const data = await getVirtualNumber();

  if (!data) return ctx.reply('❌ Impossible de récupérer un numéro pour l’instant.');

  const number = data.number;
  const country = data.country;
  const messages = data.messages || [];

  // Envoi du numéro à l'utilisateur avec boutons
  await ctx.reply(
    `✅ Voici ton numéro virtuel : +${number} (${country})`,
    Markup.inlineKeyboard([
      Markup.button.callback('📨 Inbox', `inbox_${number}`),
      Markup.button.callback('🔄 Nouveau numéro', `new_number`)
    ])
  );

  // Envoyer les messages existants au groupe
  messages.slice(-5).forEach(async msg => {
    await ctx.telegram.sendMessage(GROUP_ID, `📩 SMS de ${number} :\n\n${msg}`);
  });

  // Notification à l'admin
  await ctx.telegram.sendMessage(ADMIN_ID, `🟢 ${ctx.from.first_name} a reçu le numéro: +${number}`);
});

// Callback pour Inbox
bot.action(/inbox_(.+)/, async (ctx) => {
  const number = ctx.match[1];
  try {
    const res = await axios.get(`${NUM_API}/get_messages?number=${number}`);
    const messages = res.data.messages || [];
    if (!messages.length) return ctx.reply('📭 Pas de message pour ce numéro.');

    messages.slice(-5).forEach(msg => ctx.reply(`📩 ${msg}`));
  } catch (err) {
    console.log('Erreur inbox:', err);
    ctx.reply('❌ Impossible de récupérer les messages.');
  }
});

// Callback pour renouveler le numéro
bot.action('new_number', async (ctx) => {
  await ctx.reply('🔄 Récupération d’un nouveau numéro...');
  // Réutiliser la commande /number
  await bot.telegram.sendMessage(ctx.from.id, '/number');
});

// Démarrage du bot
bot.launch();
console.log('Bot démarré...');