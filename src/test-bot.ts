const TelegramBot = require('node-telegram-bot-api');

// Tu token temporal (¡Acuérdate de revocarlo en BotFather cuando acabemos el TFG!)
const token = '8741408957:AAEH0e_a6rqM6-bNhpfuSqElo4GnFSqUiX4';

console.log("==========================================");
console.log(" 📡 MODO DIAGNÓSTICO DE TELEGRAM INICIADO");
console.log("==========================================\n");
console.log("Esperando a que envíes /start desde el móvil...");

const bot = new TelegramBot(token, { polling: true });

bot.on('message', (msg: any) => {
    const chatId = msg.chat.id;
    console.log(`\n✅ ¡BINGO! Mensaje recibido desde el ID: ${chatId}`);
    console.log(`Texto que has enviado: ${msg.text}`);
    
    bot.sendMessage(chatId, "🎮 ¡Conexión perfecta! Te estoy respondiendo alto y claro.");
});

bot.on('polling_error', (error: any) => {
    console.log(`\n❌ ERROR DE CONEXIÓN: ${error.message}`);
});