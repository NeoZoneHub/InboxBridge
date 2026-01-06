require("dotenv").config()
const { Telegraf, Markup } = require("telegraf")
const axios = require("axios")
const cheerio = require("cheerio")

const bot = new Telegraf(process.env.BOT_TOKEN)

const CHANNEL_USERNAME = "@digitalcrew2"
const OPT_GROUP_URL = "https://t.me/DigitalaOpt"
const OPT_CHANNEL_ID = -3444717562

const userState = {}

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
    "🚀 *Bienvenue sur le bot de numéros virtuels*\n\n👉 Abonne-toi d’abord au canal officiel puis clique sur *Vérifier*.",
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
  $(".country-box a").each((i, el) => {
    const name = $(el).text().trim()
    const code = $(el).attr("href").split("/").pop()
    buttons.push([Markup.button.callback(name, `country_${code}`)])
  })

  ctx.editMessageText(
    "🌍 *Choisis un pays pour obtenir un numéro virtuel*",
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(buttons.slice(0, 40), { columns: 2 })
    }
  )
})

bot.action(/^country_/, async ctx => {
  const code = ctx.callbackQuery.data.split("_")[1]
  userState[ctx.from.id] = { country: code }

  const { data } = await axios.get(`https://sms24.me/en/countries/${code}`)
  const $ = cheerio.load(data)

  const numbers = []
  $(".number-boxes-item a").each((i, el) => {
    numbers.push($(el).attr("href"))
  })

  if (!numbers.length) {
    return ctx.answerCbQuery("Aucun numéro disponible")
  }

  const numberPath = numbers[Math.floor(Math.random() * numbers.length)]
  const number = numberPath.split("/").pop()
  userState[ctx.from.id].number = number

  ctx.editMessageText(
    `📱 *Numéro virtuel disponible*\n\n🌍 Pays : ${code.toUpperCase()}\n☎️ Numéro : \`${number}\`\n\nLes codes OPT seront envoyés automatiquement.`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔁 Changer le numéro", "change_number")],
        [
          Markup.button.url("📩 OPT Groupe", OPT_GROUP_URL),
          Markup.button.callback("🔙 Retour", "back")
        ]
      ])
    }
  )

  startOtpWatcher(number)
})

function startOtpWatcher(number) {
  setInterval(async () => {
    try {
      const { data } = await axios.get(`https://sms24.me/en/numbers/${number}`)
      const $ = cheerio.load(data)

      $(".sms-message").each(async (i, el) => {
        const text = $(el).text().trim()
        const code = text.match(/\b\d{4,8}\b/)?.[0]
        if (code) {
          await bot.telegram.sendMessage(
            OPT_CHANNEL_ID,
            `📩 *Nouveau OPT*\n\n☎️ ${number}\n🔐 Code : *${code}*\n\n${text}`,
            { parse_mode: "Markdown" }
          )
        }
      })
    } catch {}
  }, 20000)
}

bot.action("change_number", async ctx => {
  ctx.answerCbQuery()
  ctx.telegram.emit("callback_query", {
    data: `country_${userState[ctx.from.id].country}`,
    from: ctx.from,
    message: ctx.callbackQuery.message
  })
})

bot.action("back", async ctx => {
  ctx.deleteMessage()
  bot.start(ctx)
})

bot.launch()