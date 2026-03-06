import { chromium } from 'patchright';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const authPath = path.join(process.cwd(), 'auth');
if (!fs.existsSync(authPath)) fs.mkdirSync(authPath);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

(async () => {
    console.log("=======================================================");
    console.log(" 🟢 INICIANDO ASISTENTE DE SESIÓN DE EPIC GAMES");
    console.log("=======================================================\n");
    console.log(" 👉 Paso 1: Inicia sesión con tu cuenta normal.");
    console.log(" 👉 Paso 2: Resuelve los Captchas si te los pide.");
    console.log(" 👉 Paso 3: VUELVE A ESTA CONSOLA Y PULSA 'ENTER'.");
    console.log("            (No cierres la ventana del navegador con la X)\n");
    
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('https://store.epicgames.com/es-ES/login');

    rl.question("\n👉 Cuando veas tu nombre en Epic, PRESIONA ENTER AQUÍ PARA GUARDAR... ", async () => {
        console.log("\n⏳ Extrayendo cookies y guardando sesión, no toques nada...");
        
        try {
            await context.storageState({ path: path.join(authPath, 'epic_state.json') });
            console.clear();
            console.log("=======================================================");
            console.log(" ✅ ¡SESIÓN DE EPIC GAMES GUARDADA CON ÉXITO!");
            console.log("=======================================================");
            console.log(" El bot ya tiene permiso para entrar a tu cuenta sin contraseña.");
            console.log("\n 🚀 EL SIGUIENTE PASO:");
            console.log(" Escribe este comando en la consola y pulsa ENTER para arrancar el bot:");
            console.log(" npx ts-node src/index.ts\n");
        } catch (error) {
            console.log("❌ Hubo un error al guardar la sesión:", error);
        } finally {
            await browser.close();
            rl.close();
            process.exit(0);
        }
    });
})();