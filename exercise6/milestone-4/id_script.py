from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes

# función que se ejecuta al hacer /start
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    await update.message.reply_text(f"Tu ID es: {user_id}")

# crea la app con tu token
app = ApplicationBuilder().token("8315458435:AAFKv92q0sQynPOlP9aqdS3cVGAF7cympqk").build()

# conecta el comando /start con la función
app.add_handler(CommandHandler("start", start))

# ejecuta el bot
app.run_polling()
