require("dotenv").config()
const { Telegraf, Markup } = require("telegraf")
const axios = require("axios")
const cheerio = require("cheerio")

const bot = new Telegraf(process.env.BOT_TOKEN)

const CHANNEL_USERNAME = "@digitalcrew2"
const GROUP_ID = -1003575360854

const watchers = {}
const sent = new Set()

async function isSubscribed(ctx) {
  try {
    const m = await ctx.telegram.getChatMember(CHANNEL_USERNAME, ctx.from.id)
    return ["member", "administrator", "creator"].includes(m.status)
  } catch {
    return false
  }
}

function extractCode(text) {
  return text.match(/\b\d{4,8}\b/)?.[0] || "N/A"
}

bot.start(ctx => {
  ctx.reply(
    "🚀 Bienvenue\n\nAbonne-toi puis clique sur Vérifier",
    Markup.inlineKeyboard([
      [Markup.button.url("📢 Canal", "https://t.me/digitalcrew2")],
      [Markup.button.callback("✅ Vérifier", "check")]
    ])
  )
})

bot.action("check", async ctx => {
  if (!(await isSubscribed(ctx))) {
    return ctx.answerCbQuery("Abonne-toi d’abord", { show_alert: true })
  }

  const { data } = await axios.get("https://sms24.me/en/countries")
  const $ = cheerio.load(data)

  const btns = []
  $('a[href^="/en/countries/"]').each((_, el) => {
    const code = $(el).attr("href").split("/").pop()
    const name = $(el).text().trim()
    if (code && name) btns.push(Markup.button.callback(name, `c_${code}`))
  })

  ctx.editMessageText(
    "🌍 Choisis un pays",
    Markup.inlineKeyboard(btns, { columns: 2 })
  )
})

bot.action(/^c_/, async ctx => {
  const country = ctx.callbackQuery.data.split("_")[1]

  if (watchers[ctx.from.id]) {
    clearInterval(watchers[ctx.from.id])
    delete watchers[ctx.from.id]
  }

  const { data } = await axios.get(`https://sms24.me/en/countries/${country}`)
  const $ = cheerio.load(data)

  const numbers = []
  $('a[href^="/en/numbers/"]').each((_, el) => {
    numbers.push($(el).attr("href").split("/").pop())
  })

  if (!numbers.length) {
    return ctx.answerCbQuery("Aucun numéro")
  }

  const number = numbers[Math.floor(Math.random() * numbers.length)]

  ctx.editMessageText(
    `📱 Numéro actif\n\n${number}`,
    Markup.inlineKeyboard([
      [Markup.button.callback("🔁 Changer", `c_${country}`)]
    ])
  )

  watchers[ctx.from.id] = setInterval(async () => {
    try {
      const { data } = await axios.get(`https://sms24.me/en/numbers/${number}`)
      const $ = cheerio.load(data)

      $(".card-body").each(async (_, el) => {
        const from = $(el).find(".sms-from").text().replace("From:", "").trim()
        const msg = $(el).find(".sms-text").text().trim()
        if (!msg) return

        const code = extractCode(msg)
        const key = number + code + msg.length
        if (sent.has(key)) return
        sent.add(key)

        await bot.telegram.sendMessage(
          GROUP_ID,
          `📩 NOUVEAU MESSAGE\n\n☎️ Numéro : ${number}\n👤 From : ${from || "Inconnu"}\n🔐 Code : ${code}\n\n📝 ${msg}\n\n━━━━━━━━━━━━━━\n🔥 Digital Crew 243 ne dort jamais`,
          { disable_web_page_preview: true }
        )
      })
    } catch {}
  }, 12000)
})

bot.launch()