import { chromium } from 'patchright';
import { createCursor } from 'ghost-cursor-playwright-port';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { execSync } from 'child_process';

const TelegramBot = require('node-telegram-bot-api');

// ==========================================
// SISTEMA DE MEMORIA E HISTORIAL
// ==========================================
const configPath = path.join(process.cwd(), 'bot_config.json');
const historyPath = path.join(process.cwd(), 'epic_history.json');
const authPath = path.join(process.cwd(), 'auth', 'epic_state.json');

const loadConfig = () => fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};
const saveConfig = (data: any) => fs.writeFileSync(configPath, JSON.stringify({ ...loadConfig(), ...data }, null, 2));

const loadHistory = () => fs.existsSync(historyPath) ? JSON.parse(fs.readFileSync(historyPath, 'utf8')) : [];
const saveHistory = (game: string, price: string) => {
    const history = loadHistory();
    const date = new Date().toLocaleDateString('es-ES');
    history.push({ game, price, date });
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
};
const isInHistory = (game: string) => loadHistory().some((h: any) => h.game === game);

// ==========================================
// CEREBRO: API INTERNA DE EPIC GAMES
// ==========================================
async function getEpicAPIStatus() {
    try {
        const res = await fetch('https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=es-ES&country=ES&allowCountries=ES');
        const data = await res.json();
        const elements = data.data.Catalog.searchStore.elements;

        const currentFree: any[] = [];
        const upcomingFree: any[] = [];
        const now = new Date();

        elements.forEach((game: any) => {
            if (!game.promotions) return;
            const promo = game.promotions.promotionalOffers.length > 0 ? game.promotions.promotionalOffers[0].promotionalOffers[0] : null;
            const upcoming = game.promotions.upcomingPromotionalOffers.length > 0 ? game.promotions.upcomingPromotionalOffers[0].promotionalOffers[0] : null;
            
            const title = game.title;
            const price = game.price?.totalPrice?.fmtPrice?.originalPrice || "Desconocido";

            if (promo && new Date(promo.startDate) <= now && new Date(promo.endDate) > now) {
                currentFree.push({ title, price, endDate: new Date(promo.endDate) });
            } else if (upcoming && new Date(upcoming.startDate) > now) {
                upcomingFree.push({ title, price, startDate: new Date(upcoming.startDate) });
            }
        });

        return { currentFree, upcomingFree };
    } catch (e) {
        return { currentFree: [], upcomingFree: [] };
    }
}

// ==========================================
// INSTALADOR DE AUTO-ARRANQUE
// ==========================================
function installStartupScript() {
    try {
        const startupFolder = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
        const vbsPath = path.join(startupFolder, 'EpicBot_Invisible.vbs');
        const vbsContent = `Set WshShell = CreateObject("WScript.Shell")\nWshShell.CurrentDirectory = "${process.cwd()}"\nWshShell.Run "cmd.exe /c npx ts-node src/index.ts --telegram", 0, False`;
        fs.writeFileSync(vbsPath, vbsContent);
        return vbsPath;
    } catch (e) { return null; }
}

function createWindowsTask(isTestMode: boolean = false) {
    const projectPath = process.cwd();
    const ps1Path = path.join(projectPath, 'setup_task.ps1');
    let timeStr = "17:30:00";
    let triggerCmd = `$Trigger = New-ScheduledTaskTrigger -Daily -At "${timeStr}"`;

    if (isTestMode) {
        const d = new Date(); d.setMinutes(d.getMinutes() + 1);
        timeStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:00`;
        triggerCmd = `$Trigger = New-ScheduledTaskTrigger -Once -At "${timeStr}"`;
    }
    
    const psCommand = `
$ErrorActionPreference = "Stop"
$Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument '/c cd /d "${projectPath}" && npx ts-node src/index.ts --auto'
${triggerCmd}
$Settings = New-ScheduledTaskSettingsSet -WakeToRun -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
Register-ScheduledTask -TaskName "EpicGamesAutoLoop" -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Force
    `;

    try {
        fs.writeFileSync(ps1Path, psCommand.trim());
        execSync(`powershell -ExecutionPolicy Bypass -File "${ps1Path}"`, { stdio: 'ignore' });
        fs.unlinkSync(ps1Path);
        console.log(isTestMode ? `\n🧪 MODO PRUEBA: El PC ejecutará el bot en 1 MINUTO (${timeStr}).` : `\n✅ PROGRAMADO: El bot actuará TODOS LOS DÍAS a las ${timeStr}.`);
    } catch (error) {
        console.log(`\n❌ Error de permisos. Asegúrate de ejecutar CMD como ADMINISTRADOR.`);
    }
}

// ==========================================
// CEREBRO DE TELEGRAM
// ==========================================
let globalBot: any = null;

const botMenuMarkup = {
    reply_markup: {
        keyboard: [
            [{ text: "/start_epic" }, { text: "/preview" }],
            [{ text: "/historial" }, { text: "/estado" }],
            [{ text: "/apagar_pc" }, { text: "/apagar_bot" }]
        ],
        resize_keyboard: true,
        is_persistent: true
    }
};

function sendTelegramMenu(chatId: number, isGreeting = false) {
    let menuText = "🎮 **PANEL DE CONTROL EPIC GAMES** 🎮\n\n";
    if (isGreeting) menuText += "💻 _Tu PC acaba de encenderse y el bot está listo._\n\n";
    else menuText += "Tu PC está en línea y esperando órdenes.\n\n";
    
    menuText += "Usa los botones de abajo para ejecutar:\n\n" +
                "👉 **/start_epic** (Caza los juegos gratis AHORA)\n" +
                "📅 **/preview** (Ver qué juegos regalan hoy y la próxima semana)\n" +
                "📜 **/historial** (Ver todo lo que has reclamado y el dinero ahorrado)\n" +
                "⚙️ **/estado** (Ver si la tarea diaria está activa)\n" +
                "🔌 **/apagar_pc** (Apaga el ordenador físicamente)\n" +
                "🛑 **/apagar_bot** (Cierra el bot pero deja el PC encendido)";
    
    globalBot.sendMessage(chatId, menuText, { parse_mode: 'Markdown', ...botMenuMarkup });
}

function startTelegramBot(isGhostMode = false) {
    const config = loadConfig();
    if (!config.telegramToken) return; 

    globalBot = new TelegramBot(config.telegramToken, { polling: true });

    globalBot.on('polling_error', (error: any) => {
        if (error.code === 'ETELEGRAM' && error.message.includes('409')) process.exit(0); 
    });

    globalBot.on('message', (msg: any) => {
        if (msg.chat && msg.chat.id) saveConfig({ chatId: msg.chat.id });
    });

    if (config.chatId && isGhostMode) {
        setTimeout(() => { try { sendTelegramMenu(config.chatId, true); } catch (e) {} }, 4000); 
    }

    globalBot.onText(/\/(start|menu)/, (msg: any) => { sendTelegramMenu(msg.chat.id, false); });

    globalBot.onText(/\/start_epic/, async (msg: any) => {
        const chatId = msg.chat.id;
        await globalBot.sendMessage(chatId, "🤖 **Modo Cazador Activado.**\nIniciando escáner inteligente...", { parse_mode: 'Markdown' });
        await runEpicLoop(false, globalBot, chatId);
    });

    globalBot.onText(/\/preview/, async (msg: any) => {
        const chatId = msg.chat.id;
        await globalBot.sendMessage(chatId, "🔍 Consultando la base de datos de Epic Games...");
        const data = await getEpicAPIStatus();
        
        let res = "📅 **CARTELERA DE JUEGOS GRATIS** 📅\n\n";
        res += "🎁 **DISPONIBLES AHORA MISMO:**\n";
        if (data.currentFree.length === 0) res += "❌ Ninguno encontrado.\n";
        data.currentFree.forEach(g => {
            res += `🕹️ *${g.title}*\n💰 Precio normal: ~${g.price}~\n⏳ Termina el: ${g.endDate.toLocaleDateString('es-ES')}\n\n`;
        });

        res += "🔜 **PRÓXIMAMENTE (Siguiente semana):**\n";
        if (data.upcomingFree.length === 0) res += "❌ Aún no anunciados.\n";
        data.upcomingFree.forEach(g => {
            res += `🕹️ *${g.title}*\n💰 Precio normal: ~${g.price}~\n📅 Empieza el: ${g.startDate.toLocaleDateString('es-ES')}\n\n`;
        });

        globalBot.sendMessage(chatId, res, { parse_mode: 'Markdown', ...botMenuMarkup });
    });

    globalBot.onText(/\/historial/, (msg: any) => {
        const chatId = msg.chat.id;
        const history = loadHistory();
        if (history.length === 0) {
            globalBot.sendMessage(chatId, "📜 **Historial Vacío**\nAún no has reclamado ningún juego con el bot.", { parse_mode: 'Markdown', ...botMenuMarkup });
            return;
        }

        let res = "📜 **TU HISTORIAL DE RECOMPENSAS** 📜\n\n";
        let totalSaved = 0;
        history.forEach((item: any) => {
            res += `📅 *${item.date}* -> ${item.game} (~${item.price}~)\n`;
            const priceNum = parseFloat(item.price.replace(',', '.').replace(/[^\d.-]/g, ''));
            if (!isNaN(priceNum)) totalSaved += priceNum;
        });
        res += `\n💎 **TOTAL DE DINERO AHORRADO: ${totalSaved.toFixed(2)}€** 💎`;
        globalBot.sendMessage(chatId, res, { parse_mode: 'Markdown', ...botMenuMarkup });
    });

    globalBot.onText(/\/estado/, async (msg: any) => {
        const chatId = msg.chat.id;
        const currentConfig = loadConfig();
        let statusMsg = "📊 **ESTADO DEL SISTEMA EPIC:**\n\n🔌 Servidor PC: `EN LÍNEA`\n";
        if (currentConfig.autoEnabled) statusMsg += `✅ Tarea Automática: ACTIVADA\n(Todos los días a las 17:30h)\n`;
        else statusMsg += `⚠️ Tarea Automática: DESACTIVADA\n`;
        await globalBot.sendMessage(chatId, statusMsg, { parse_mode: 'Markdown', ...botMenuMarkup });
    });

    globalBot.onText(/\/apagar_pc/, (msg: any) => {
        globalBot.sendMessage(msg.chat.id, "🔌 Apagando el ordenador en 5 segundos. ¡Buenas noches!", { reply_markup: { remove_keyboard: true } });
        setTimeout(() => { try { execSync('shutdown /s /t 5'); process.exit(0); } catch (e) {} }, 1000);
    });

    globalBot.onText(/\/apagar_bot/, (msg: any) => {
        globalBot.sendMessage(msg.chat.id, "🛑 Servidor remoto apagado. El PC seguirá encendido.", { reply_markup: { remove_keyboard: true } });
        setTimeout(() => { process.exit(0); }, 1000);
    });
}

// ==========================================
// MOTOR CENTRAL DE EXTRACCIÓN Y PAGO
// ==========================================
async function runEpicLoop(exitOnFinish = true, botObj?: any, chatId?: number) {
    const isSilent = process.argv.includes('--telegram') || process.argv.includes('--auto');

    if (!isSilent) console.log("\n[▶] Analizando los servidores de Epic Games...");

    // 1. FAST CHECK (Ahorro de RAM con la API)
    const apiData = await getEpicAPIStatus();
    const pendingGames = apiData.currentFree.filter(g => !isInHistory(g.title));

    if (pendingGames.length === 0) {
        if (!isSilent) console.log("✅ ¡Todo al día! Ya tienes todos los juegos gratuitos de esta semana.");
        if (botObj && chatId && !process.argv.includes('--auto')) botObj.sendMessage(chatId, "✅ **¡Todo al día!**\nNo hay juegos gratis nuevos o ya los tienes todos en tu biblioteca.", { parse_mode: 'Markdown' });
        if (exitOnFinish) process.exit(0);
        return;
    }

    if (!fs.existsSync(authPath)) {
        if (!isSilent) console.log('❌ Error: Archivo de sesión no encontrado.');
        if (botObj && chatId) botObj.sendMessage(chatId, "❌ Error crítico: Sesión no encontrada. Ejecuta save-session.ts en el PC.");
        if (exitOnFinish) process.exit(1); return;
    }

    if (!isSilent) console.log(`🎯 Abriendo navegador fantasma...`);
    const browser = await chromium.launch({ 
        headless: isSilent,
        args: ['--disable-web-security', '--disable-features=IsolateOrigins,site-per-process']
    }); 
    const context = await browser.newContext({ storageState: authPath });
    const page = await context.newPage();
    let gamesClaimed = 0;

    try {
        await page.goto('https://store.epicgames.com/es-ES/free-games', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(8000);

        // 2. EXTRAER ENLACES DEL DOM (Evita el bug de quedarse atascado en el primer juego)
        const freeGameUrls = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('span, p, div, h3')).filter(el => 
                el.textContent?.trim() === 'Gratis ahora' || el.textContent?.trim() === 'Free Now'
            );
            const urls = new Set<string>();
            elements.forEach(el => {
                const link = el.closest('a');
                if (link && link.href) urls.add(link.href);
            });
            return Array.from(urls);
        });

        // 3. BUCLE DE COMPRA SEGURO
        for (const url of freeGameUrls) {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(5000);

            const rawTitle = await page.title();
            const gameTitle = rawTitle.replace('- Epic Games Store', '').trim();

            if (isInHistory(gameTitle)) {
                if (!isSilent) console.log(` -> ⏭️  ${gameTitle} ya está en el historial. Saltando...`);
                continue;
            }

            let originalPrice = "Desconocido";
            try {
                originalPrice = await page.evaluate(() => {
                    const strike = document.querySelector('s'); 
                    if (strike && strike.innerText.match(/\d/)) return strike.innerText.trim();
                    return "Desconocido";
                });
            } catch(e) {}

            if (!isSilent) console.log(`\n[▶] Intentando reclamar: ${gameTitle}`);

            const ageWarning = page.getByRole('button', { name: 'Continuar' }).first();
            if (await ageWarning.isVisible({ timeout: 2000 })) await ageWarning.click();

            const inLibrary = await page.locator('text="En la biblioteca", text="In Library"').count();
            if (inLibrary > 0) {
                if (!isSilent) console.log(" -> ✅ Ya estaba en tu biblioteca. Lo añado al historial.");
                saveHistory(gameTitle, originalPrice);
                continue;
            }

            const getBtn = page.getByTestId('purchase-cta-button');
            if (await getBtn.isVisible({ timeout: 5000 })) {
                await getBtn.click();
            } else { 
                if (!isSilent) console.log(" -> [!] Botón OBTENER no disponible. Saltando.");
                continue; 
            }

            if (!isSilent) console.log(' -> ⏳ Esperando cajón de pago (Modo Martillo)...');
            await page.waitForTimeout(10000); 
            
            let paymentSuccess = false;

            for (let i = 0; i < 15; i++) {
                if (paymentSuccess) break;
                for (const frame of page.frames()) {
                    try {
                        const clicked = await frame.evaluate(() => {
                            const buttons = Array.from(document.querySelectorAll('button'));
                            const target = buttons.find(b => b.innerText.toLowerCase().includes('pedido') || b.innerText.toLowerCase().includes('order'));
                            if (target && !target.disabled) { target.click(); return true; }
                            return false;
                        });
                        if (clicked) { paymentSuccess = true; break; }
                    } catch (e) { }
                }
                if (!paymentSuccess) await page.waitForTimeout(1000); 
            }

            if (paymentSuccess) {
                await page.waitForTimeout(10000); 
                if (!isSilent) console.log(` -> ✅ ¡DESCARGADO!`);
                if (botObj && chatId) {
                    botObj.sendMessage(chatId, `🎁 **¡JUEGO RECLAMADO CON ÉXITO!**\n\n🕹️ ${gameTitle}\n💸 Te has ahorrado: *${originalPrice}*`, { parse_mode: 'Markdown' });
                }
                saveHistory(gameTitle, originalPrice);
                gamesClaimed++;
            } else {
                if (!isSilent) console.log(" -> ❌ Falló la compra.");
            }
        }

        if (botObj && chatId && gamesClaimed > 0) {
            botObj.sendMessage(chatId, `🎉 **Resumen Final:** Has conseguido ${gamesClaimed} juego(s) gratis hoy.`, { parse_mode: 'Markdown', ...botMenuMarkup });
        }

    } catch (error) {
        if (!isSilent) console.log('❌ Error crítico general:', error);
        if (botObj && chatId) botObj.sendMessage(chatId, "❌ Ocurrió un error inesperado al escanear la web.");
    } finally {
        if (!isSilent) console.log('\n✅ Proceso finalizado. Cerrando navegador...');
        await browser.close();
        if (exitOnFinish) process.exit(0);
    }
}

// ==========================================
// INTERFAZ DE CONSOLA 
// ==========================================
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function showMenu() {
    console.clear();
    console.log("  ___ ___ ___ ___    ___   _   __  __ ___ ___ ");
    console.log(" | __| _ \\_ _/ __|  / __| /_\\ |  \\/  | __/ __|");
    console.log(" | _||  _/| | (__  | (_ |/ _ \\| |\\/| | _|\\__ \\");
    console.log(" |___|_| |___\\___|  \\___/_/ \\_\\_|  |_|___|___/");
    console.log("===================================================================");
    console.log("|              BOT RECLAMADOR AUTOMÁTICO v6.0                     |");
    console.log("===================================================================\n");
    console.log("  [1] 📖 Instrucciones Rápidas");
    console.log("  [2] 🚀 Ejecutar AHORA (Cazar juegos gratis)");
    console.log("  [3] 📅 Previsualizar Tienda (Juegos actuales y futuros)");
    console.log("  [4] 📜 Ver Historial de Ahorro");
    console.log("  [5] ⚙️  GESTIÓN AUTOMÁTICA (Diaria 17:30)");
    console.log("  [6] 📱 GESTIÓN TELEGRAM (Servidor Remoto y Token)");
    console.log("  [7] ❌ Salir\n");
    rl.question("  [#] Selecciona una opción > ", handleMenu);
}

async function handleMenu(option: string) {
    switch (option.trim()) {
        case '1': showInstructions(); break;
        case '2': rl.close(); runEpicLoop(true); break;
        case '3': await handlePreview(); break;
        case '4': handleHistory(); break;
        case '5': handleAutomationSubMenu(); break;
        case '6': handleTelegramSubMenu(); break;
        case '7': process.exit(0); break;
        default: showMenu(); break;
    }
}

function showInstructions() {
    console.clear();
    console.log("===================================================================");
    console.log(" 📖 INSTRUCCIONES RÁPIDAS");
    console.log("===================================================================\n");
    console.log("1. EL ARCHIVO DE SESIÓN:");
    console.log("   Ejecuta 'save-session.ts' antes que nada para guardar tu cuenta.");
    console.log("\n2. CONECTAR TU MÓVIL (TELEGRAM):");
    console.log("   -> Ve a la Opción 6 del menú principal y pega tu Token.");
    console.log("   -> Abre el bot en tu móvil y escribe /start");
    console.log("\n3. AUTOMATIZACIÓN INTELIGENTE:");
    console.log("   Si activas la Opción 5, el bot revisará la API de Epic todos");
    console.log("   los días. Si hay un juego que no tienes, lo reclamará de forma");
    console.log("   invisible. Si ya lo tienes, ni siquiera gastará memoria.\n");
    rl.question("Presiona ENTER para volver al menú...", () => showMenu());
}

async function handlePreview() {
    console.clear();
    console.log("⏳ Conectando con la base de datos de Epic Games...\n");
    const data = await getEpicAPIStatus();
    
    console.log("=================================================");
    console.log(" 🎁 JUEGOS GRATIS ACTUALES");
    console.log("=================================================");
    if (data.currentFree.length === 0) console.log("   ❌ Ninguno en este momento.");
    data.currentFree.forEach(g => console.log(`   🕹️  ${g.title} (${g.price})\n       Termina: ${g.endDate.toLocaleDateString('es-ES')}\n`));

    console.log("=================================================");
    console.log(" 🔜 PRÓXIMA SEMANA");
    console.log("=================================================");
    if (data.upcomingFree.length === 0) console.log("   ❌ Aún no anunciados.");
    data.upcomingFree.forEach(g => console.log(`   🕹️  ${g.title} (${g.price})\n       Empieza: ${g.startDate.toLocaleDateString('es-ES')}\n`));
    
    rl.question("Presiona ENTER para volver...", () => showMenu());
}

function handleHistory() {
    console.clear();
    const history = loadHistory();
    console.log("=================================================");
    console.log(" 📜 TU HISTORIAL DE RECOMPENSAS");
    console.log("=================================================\n");
    
    if (history.length === 0) {
        console.log("   Aún no has reclamado ningún juego con el bot.\n");
    } else {
        let totalSaved = 0;
        history.forEach((item: any) => {
            console.log(`  [${item.date}] ${item.game} -> Ahorro: ${item.price}`);
            const priceNum = parseFloat(item.price.replace(',', '.').replace(/[^\d.-]/g, ''));
            if (!isNaN(priceNum)) totalSaved += priceNum;
        });
        console.log("\n-------------------------------------------------");
        console.log(` 💎 DINERO TOTAL AHORRADO: ${totalSaved.toFixed(2)}€`);
        console.log("-------------------------------------------------\n");
    }
    rl.question("Presiona ENTER para volver...", () => showMenu());
}

function handleAutomationSubMenu() {
    console.clear();
    console.log("⚙️  CONFIGURACIÓN DE AUTOMATIZACIÓN DIARIA\n");
    const config = loadConfig();
    
    if (config.autoEnabled) console.log(`   🟢 ESTADO ACTUAL: ACTIVO (Escaneo Diario a las 17:30h)\n`);
    else console.log(`   🔴 ESTADO ACTUAL: DESACTIVADO\n`);

    console.log("  [1] ✅ ACTIVAR (Ajustar tarea en Windows)");
    console.log("  [2] 🧪 MODO PRUEBA (Ejecutar en 1 MINUTO para testear)");
    console.log("  [3] 🛑 DESACTIVAR (Borrar tarea de Windows)");
    console.log("  [4] 🔙 Volver\n");
    
    rl.question("  [#] Elige > ", (opt) => {
        if (opt === '1') {
            createWindowsTask(false);
            saveConfig({ autoEnabled: true });
            rl.question("\nPresiona ENTER...", () => showMenu());
        } else if (opt === '2') {
            createWindowsTask(true);
            rl.question("\nPresiona ENTER...", () => showMenu());
        } else if (opt === '3') {
            try { execSync(`schtasks /Delete /TN "EpicGamesAutoLoop" /F`, { stdio: 'ignore' }); } catch(e){}
            saveConfig({ autoEnabled: false });
            console.log("\n✅ Automatización borrada.");
            rl.question("\nPresiona ENTER...", () => showMenu());
        } else showMenu();
    });
}

function handleTelegramSubMenu() {
    console.clear();
    console.log("📱 CONFIGURACIÓN DEL SERVIDOR TELEGRAM\n");
    const config = loadConfig();
    const startupFolder = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
    const vbsPath = path.join(startupFolder, 'EpicBot_Invisible.vbs');
    
    if (!config.telegramToken) console.log(`   🔴 ESTADO: Ningún Token configurado.\n`);
    else if (fs.existsSync(vbsPath)) console.log(`   🟢 ESTADO: ACTIVO (Inmortal. Escuchando al móvil de fondo).\n`);
    else console.log(`   🟡 ESTADO: DESACTIVADO (Token guardado, pero no arrancará con Windows).\n`);

    console.log("  [1] 🚀 ACTIVAR Servidor en Segundo Plano (Hacer Inmortal)");
    console.log("  [2] 🛑 DESACTIVAR Servidor (Borrar Auto-arranque)");
    console.log("  [3] 🔑 Configurar / Cambiar Token Personal de BotFather");
    console.log("  [4] 🔙 Volver al menú principal\n");

    rl.question("  [#] Elige > ", (opt) => {
        if (opt === '1') {
            if (!config.telegramToken) console.log("\n❌ ERROR: Primero debes configurar el Token (Opción 3).");
            else { installStartupScript(); console.log("\n✅ SERVIDOR ACTIVADO EN SEGUNDO PLANO."); }
            rl.question("\nPresiona ENTER para volver...", () => handleTelegramSubMenu());
        } else if (opt === '2') {
            if (fs.existsSync(vbsPath)) fs.unlinkSync(vbsPath);
            console.log("\n✅ Auto-arranque desactivado.");
            rl.question("\nPresiona ENTER para volver...", () => handleTelegramSubMenu());
        } else if (opt === '3') {
            rl.question("\n-> Pega aquí tu Token de Telegram: ", (token) => {
                if (token.length > 20) { saveConfig({ telegramToken: token.trim() }); console.log("\n✅ Token guardado."); }
                rl.question("\nPresiona ENTER...", () => handleTelegramSubMenu());
            });
        } else showMenu();
    });
}

// ==========================================
// ARRANQUE PRINCIPAL
// ==========================================
(async () => {
    if (process.argv.includes('--telegram')) {
        startTelegramBot(true);
    } else if (process.argv.includes('--auto')) {
        console.log("⏰ EJECUCIÓN AUTOMÁTICA INICIADA");
        const config = loadConfig();
        let telegramBotInstance = null;
        if (config.telegramToken) telegramBotInstance = new TelegramBot(config.telegramToken, { polling: false });
        await runEpicLoop(true, telegramBotInstance, config.chatId);
    } else {
        startTelegramBot(false);
        showMenu();
    }
})();