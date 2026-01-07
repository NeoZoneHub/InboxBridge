require("dotenv").config()
const { Telegraf, Markup } = require("telegraf")
const axios = require("axios")
const cheerio = require("cheerio")

const bot = new Telegraf(process.env.BOT_TOKEN)

const CHANNEL_USERNAME = "@digitalcrew2"
const GROUP_ID = -1003575360854
const OPT_GROUP_URL = "https://t.me/+FvKX3xIqsIpiYmI0"

const watchers = {}
const sentMessages = new Set()

async function isSubscribed(ctx) {
  try {
    const member = await ctx.telegram.getChatMember(CHANNEL_USERNAME, ctx.from.id)
    return ["member", "administrator", "creator"].includes(member.status)
  } catch {
    return false
  }
}

function detectPlatform(text) {
  const t = text.toLowerCase()
  if (t.includes("whatsapp")) return "WhatsApp"
  if (t.includes("tiktok")) return "TikTok"
  if (t.includes("telegram")) return "Telegram"
  if (t.includes("facebook")) return "Facebook"
  if (t.includes("instagram")) return "Instagram"
  if (t.includes("google")) return "Google"
  if (t.includes("twitter") || t.includes("x.com")) return "X / Twitter"
  if (t.includes("gopuff")) return "GoPuff"
  if (t.includes("ath móvil")) return "ATH Móvil"
  return "Autre"
}

function extractCode(text) {
  const codeMatch = text.match(/\b\d{4,8}\b/)
  return codeMatch ? codeMatch[0] : "Pas de code détecté"
}

function extractSender(text) {
  if (text.includes("From:")) {
    const match = text.match(/From:\s*(.+?)(?:\n|$)/)
    return match ? match[1].trim() : "Expéditeur inconnu"
  }
  return "Expéditeur inconnu"
}

bot.start(ctx => {
  ctx.reply(
    "🚀 *Bienvenue sur le bot de numéros virtuels*\n\n👉 Abonne-toi au canal puis clique sur *Vérifier*.",
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.url("📢 Rejoindre le canal", "https://t.me/digitalcrew2")],
        [Markup.button.callback("✅ Vérifier", "check_sub")]
      ])
    }
  )
})

bot.action("check_sub", async ctx => {
  if (!(await isSubscribed(ctx))) {
    return ctx.answerCbQuery("❌ Abonnement non détecté", { show_alert: true })
  }

  const { data } = await axios.get("https://sms24.me/en/countries")
  const $ = cheerio.load(data)

  const buttons = []
  $('a[href^="/en/countries/"]').each((i, el) => {
    const code = $(el).attr("href").split("/").pop()
    const name = $(el).text().trim()
    if (code && name) {
      buttons.push(Markup.button.callback(name, `country_${code}`))
    }
  })

  ctx.editMessageText(
    "🌍 *Choisis un pays pour obtenir un numéro virtuel*",
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(buttons, { columns: 2 })
    }
  )
})

bot.action(/^country_/, async ctx => {
  const country = ctx.callbackQuery.data.split("_")[1]

  if (watchers[ctx.from.id]) {
    clearInterval(watchers[ctx.from.id])
    delete watchers[ctx.from.id]
  }

  const { data } = await axios.get(`https://sms24.me/en/countries/${country}`)
  const $ = cheerio.load(data)

  const numbers = []
  $('a[href^="/en/numbers/"]').each((i, el) => {
    numbers.push($(el).attr("href").split("/").pop())
  })

  if (!numbers.length) {
    return ctx.answerCbQuery("Aucun numéro actif")
  }

  const number = numbers[Math.floor(Math.random() * numbers.length)]

  ctx.editMessageText(
    `📱 *Numéro actif*\n\n🌍 ${country.toUpperCase()}\n☎️ \`${number}\``,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔁 Changer le numéro", `change_${country}`)],
        [Markup.button.url("📩 Groupe OTP", OPT_GROUP_URL)]
      ])
    }
  )

  watchers[ctx.from.id] = setInterval(async () => {
    try {
      const { data } = await axios.get(`https://sms24.me/en/numbers/${number}`)
      const $ = cheerio.load(data)

      $(".sms-message").each(async (i, el) => {
        const text = $(el).text().trim()
        if (!text) return

        const messageId = number + "_" + text.replace(/\s+/g, '')
        if (sentMessages.has(messageId)) return
        sentMessages.add(messageId)

        const code = extractCode(text)
        const platform = detectPlatform(text)
        const sender = extractSender(text)

        const messageText = `📩 *NOUVEAU MESSAGE*\n\n☎️ *Numéro* : \`${number}\`\n📨 *Expéditeur* : ${sender}\n📦 *Plateforme* : ${platform}\n🔐 *Code* : \`${code}\`\n\n📝 ${text}\n\n━━━━━━━━━━━━━━━\n🔥 *Digital Crew 243* — ne dort jamais.`

        try {
          await bot.telegram.sendMessage(
            GROUP_ID,
            messageText,
            { parse_mode: "Markdown" }
          )
        } catch {}
      })
    } catch {}
  }, 15000)
})

bot.action(/^change_/, ctx => {
  const country = ctx.callbackQuery.data.split("_")[1]
  ctx.answerCbQuery()
  ctx.deleteMessage()
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "🔄 Changement du numéro",
    Markup.inlineKeyboard([
      [Markup.button.callback("📱 Nouveau numéro", `country_${country}`)]
    ])
  )
})

bot.launch()