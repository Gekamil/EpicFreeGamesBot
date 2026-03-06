# EpicFreeGamesBot

# 🎮 Epic Games Auto-Redeemer & Telegram C2

![Versión](https://img.shields.io/badge/Versión-6.0-blue.svg)
![Estado](https://img.shields.io/badge/Estado-Activo_y_Funcional-brightgreen.svg)
![Plataforma](https://img.shields.io/badge/Plataforma-Windows_10%2F11-lightgrey.svg)

Un bot autónomo de nivel profesional diseñado para reclamar automáticamente los juegos gratuitos semanales de la **Epic Games Store**. Construido con TypeScript y Playwright, este sistema cuenta con un motor inteligente que consulta la API interna de Epic, optimiza el consumo de recursos (RAM) y se controla íntegramente de forma remota a través de Telegram.

##  Características Principales

* **Inteligencia de Red (API Checker):** El bot no abre el navegador a ciegas. Primero consulta la base de datos interna de Epic Games de forma silenciosa. Si no hay juegos nuevos o ya están en tu historial, el proceso se suicida en 0.5 segundos para no gastar memoria RAM.
* **Servidor C2 (Telegram):** Controla todo el sistema desde tu móvil. Recibe alertas de nuevos juegos, precios, dinero ahorrado, o manda a apagar tu PC de forma remota con una interfaz de botones intuitiva.
* ** (Iframe Bypass):** Un algoritmo de inyección JS puro capaz de perforar las protecciones Cross-Origin y los Iframes dinámicos de la pasarela de pago de Epic para asegurar el clic de compra al 100%.
* **(Windows Daemon):** Capacidad para inyectar scripts VBS invisibles en el inicio del sistema y programar tareas automáticas (`schtasks`) para que opere en segundo plano todos los días a las 17:30h.
* ** Tasador de Precios:** Extrae el valor real del juego antes del descuento y mantiene un historial local en formato JSON calculando el dinero total que te ha ahorrado a lo largo del tiempo.

## Requisitos Previos

* **Node.js** (v16 o superior)
* **npm** o **yarn**
* Un Token de Bot de Telegram (Obtenido vía *BotFather*)
* Una cuenta de Epic Games

##  Instalación y Configuración

1. **Clonar el repositorio:**
   ```bash
   git clone [https://github.com/TuUsuario/Epic_Games_Bot.git](https://github.com/TuUsuario/Epic_Games_Bot.git)
   cd Epic_Games_Bot
