require("dotenv").config()
const { Telegraf, Markup } = require("telegraf")
const axios = require("axios")
const cheerio = require("cheerio")

const bot = new Telegraf(process.env.BOT_TOKEN)

const CHANNEL_USERNAME = "@digitalcrew2"
const OPT_GROUP_URL = "https://t.me/DigitalaOpt"
const OPT_CHANNEL_ID = -1003444717562

const otpWatchers = {}
const sentOtps = new Set()

async function isSubscribed(ctx) {
  try {
    const member = await ctx.telegram.getChatMember(CHANNEL_USERNAME, ctx.from.id)
    return ["member", "administrator", "creator"].includes(member.status)
  } catch {
    return false
  }
}

bot.start(async ctx => {
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
  const ok = await isSubscribed(ctx)
  if (!ok) {
    return ctx.answerCbQuery("❌ Abonnement non détecté", { show_alert: true })
  }

  const { data } = await axios.get("https://sms24.me/en/countries")
  const $ = cheerio.load(data)

  const buttons = []

  $('a[href^="/en/countries/"]').each((i, el) => {
    const href = $(el).attr("href")
    const code = href.split("/").pop()
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
  const code = ctx.callbackQuery.data.split("_")[1]

  if (otpWatchers[ctx.from.id]) {
    clearInterval(otpWatchers[ctx.from.id])
    delete otpWatchers[ctx.from.id]
  }

  const { data } = await axios.get(`https://sms24.me/en/countries/${code}`)
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
    `📱 *Numéro virtuel actif*\n\n🌍 ${code.toUpperCase()}\n☎️ \`${number}\`\n\nLes OTP seront envoyés automatiquement.`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔁 Changer le numéro", `change_${code}`)],
        [
          Markup.button.url("📩 OPT Groupe", OPT_GROUP_URL),
          Markup.button.callback("🔙 Retour", "back")
        ]
      ])
    }
  )

  otpWatchers[ctx.from.id] = setInterval(async () => {
    try {
      const { data } = await axios.get(`https://sms24.me/en/numbers/${number}`)
      const $ = cheerio.load(data)

      $(".sms-message").each(async (i, el) => {
        const text = $(el).text().trim()
        const codeOtp = text.match(/\b\d{4,8}\b/)?.[0]
        const key = number + codeOtp

        if (codeOtp && !sentOtps.has(key)) {
          sentOtps.add(key)
          await bot.telegram.sendMessage(
            OPT_CHANNEL_ID,
            `📩 *Nouveau OTP*\n\n☎️ ${number}\n🔐 *${codeOtp}*\n\n${text}`,
            { parse_mode: "Markdown" }
          )
        }
      })
    } catch {}
  }, 20000)
})

bot.action(/^change_/, async ctx => {
  const code = ctx.callbackQuery.data.split("_")[1]
  ctx.answerCbQuery()
  ctx.deleteMessage()
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "🔄 Changement du numéro…",
    Markup.inlineKeyboard([
      [Markup.button.callback("🔁 Charger un nouveau numéro", `country_${code}`)]
    ])
  )
})

bot.action("back", ctx => {
  if (otpWatchers[ctx.from.id]) {
    clearInterval(otpWatchers[ctx.from.id])
    delete otpWatchers[ctx.from.id]
  }
  ctx.deleteMessage()
  bot.start(ctx)
})

bot.launch()