require("dotenv").config()
const { Telegraf, Markup } = require("telegraf")
const axios = require("axios")

const bot = new Telegraf(process.env.BOT_TOKEN)

const CHANNEL_USERNAME = "@digitalcrew2"
const OPT_CHANNEL_ID = -3444717562

let userCountry = {}

async function isSubscribed(ctx) {
  try {
    const member = await ctx.telegram.getChatMember(CHANNEL_USERNAME, ctx.from.id)
    return ["member", "administrator", "creator"].includes(member.status)
  } catch {
    return false
  }
}

bot.start(async ctx => {
  const ok = await isSubscribed(ctx)
  if (!ok) {
    return ctx.reply(
      "🚀 *Accès requis*\n\nPour utiliser ce bot de numéros virtuels, tu dois d’abord rejoindre notre canal officiel.\n\nUne fois abonné, reviens ici et clique à nouveau sur *Start*.",
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.url("📢 Rejoindre le canal", "https://t.me/digitalcrew2")]
        ])
      }
    )
  }

  const { data } = await axios.get("https://api.vreden.my.id/api/tools/fakenumber/country")
  const buttons = data.result.map(c =>
    [Markup.button.callback(c.title, `country_${c.id}`)]
  )

  ctx.reply(
    "🌍 *Choisis un pays pour obtenir un numéro virtuel*",
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(buttons, { columns: 2 })
    }
  )
})

bot.action(/^country_/, async ctx => {
  const country = ctx.callbackQuery.data.split("_")[1]
  userCountry[ctx.from.id] = country

  const { data } = await axios.get(
    `https://api.vreden.my.id/api/tools/fakenumber/listnumber?id=${country}`
  )

  if (!data.result.length) {
    return ctx.answerCbQuery("Aucun numéro disponible")
  }

  const number = data.result[0].number

  ctx.editMessageText(
    `📱 *Numéro virtuel disponible*\n\n🌍 Pays : ${country.toUpperCase()}\n☎️ Numéro : \`${number}\`\n\nLes codes OPT reçus seront envoyés automatiquement dans le groupe.`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔁 Changer le numéro", "change_num")],
        [
          Markup.button.url("📩 OPT Groupe", "https://t.me/DigitalaOpt"),
          Markup.button.callback("🔙 Retour", "back")
        ]
      ])
    }
  )

  setInterval(async () => {
    const { data } = await axios.get(
      `https://api.vreden.my.id/api/tools/fakenumber/message?nomor=${encodeURIComponent(number)}`
    )

    if (data.result?.length) {
      for (const msg of data.result) {
        const code = msg.content.match(/\b\d{4,8}\b/)?.[0] || "N/A"
        await bot.telegram.sendMessage(
          OPT_CHANNEL_ID,
          `📩 *Nouveau OPT*\n\n☎️ ${number}\n🔐 Code : *${code}*\n🕒 ${msg.time_wib}\n\n${msg.content}`,
          { parse_mode: "Markdown" }
        )
      }
    }
  }, 15000)
})

bot.action("change_num", async ctx => {
  const country = userCountry[ctx.from.id]
  ctx.answerCbQuery()
  ctx.deleteMessage()
  ctx.telegram.emit("callback_query", {
    data: `country_${country}`,
    from: ctx.from,
    message: ctx.callbackQuery.message
  })
})

bot.action("back", async ctx => {
  ctx.deleteMessage()
  bot.handleUpdate({ message: { text: "/start", from: ctx.from, chat: ctx.chat } })
})

bot.launch()