import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  proto,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
// import * as qrcode from "qrcode-terminal";
import * as QRCode from "qrcode";
import WebSocket, { WebSocketServer } from "ws";
import fs from "fs";

// Puerto para el websockets
const wss = new WebSocketServer({ port: 8080 });

// Diccionario para almacenar el estado del flujo de conversación de cada usuario
const userSteps: { [key: string]: any } = {};

// Función principal para iniciar el bot
export async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    getMessage: async (key) => {
      return undefined;
    },
  });

  // Manejar el estado de la conexión
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;
      console.log("Conexión cerrada, reconectar:", shouldReconnect);
      if (shouldReconnect) {
        startBot(); // Intentar reconectar si no fue una desconexión voluntaria
      }
    } else if (connection === "open") {
      console.log("Conectado a WhatsApp");
    }

    if (qr) {
      // Generar QR en base64
      // const qrCode = await qrcode.generate(qr, { small: true });

      // Guardar QR como imagen
      // fs.writeFileSync("./public/qr.html", `<img src="${qrCode}" />`);

      const qrImagePath = "./public/assets/qr.png";
      QRCode.toFile(qrImagePath, qr, (err) => {
        if (err) throw err;
        console.log("QR code saved at:", qrImagePath);

        // Enviar QR a los clientes conectados
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(qrImagePath);
          }
        });
      });
    }
  });

  sock.ev.on("creds.update", saveCreds);

  // Listener para mensajes recibidos
  sock.ev.on("messages.upsert", async (msg) => {
    const message = msg.messages[0];
    if (!message.message || message.key.fromMe) return;

    const from = message.key.remoteJid!;
    const body =
      message.message.conversation ||
      message.message.extendedTextMessage?.text ||
      "";

    console.log(`Mensaje de ${from}: ${body}`);

    // Si el usuario ya está en el flujo de soporte técnico, continuamos ese flujo
    if (userSteps[from]?.step) {
      await handleSupportFlow(sock, from, body);
    } else if (body.toLowerCase() === "hola") {
      // Iniciar la conversación con opciones
      await sendGreeting(sock, from);
    } else if (body === "1") {
      // Iniciar el flujo de soporte técnico
      userSteps[from] = { step: "start" };
      await handleSupportFlow(sock, from, body);
    } else if (body.toLowerCase() === "gracias") {
      // Responder cuando el usuario dice "gracias"
      await sendMessage(
        sock,
        from,
        "De nada. Si necesitas más ayuda, no dudes en comunicarte nuevamente. Puedes iniciar una nueva conversación en cualquier momento."
      );
    } else {
      // Manejo de opciones inválidas
      await sendMessage(
        sock,
        from,
        'Por favor selecciona una opción válida respondiendo con el número "1" para Soporte Técnico.'
      );
    }
  });
}

// Función auxiliar para enviar mensajes de texto
export async function sendMessage(sock: any, jid: string, content: string) {
  const message = { text: content };
  await sock.sendMessage(jid, message);
}

// Función para manejar el flujo de soporte técnico
async function handleSupportFlow(sock: any, from: string, body: string) {
  const currentStep = userSteps[from]?.step || "start";

  switch (currentStep) {
    case "start":
      userSteps[from].step = "name";
      await sendMessage(
        sock,
        from,
        "Bienvenido a soporte técnico. ¿Cuál es tu nombre?"
      );
      break;

    case "name":
      userSteps[from].name = body;
      userSteps[from].step = "email";
      await sendMessage(sock, from, "Gracias. ¿Cuál es tu correo electrónico?");
      break;

    case "email":
      userSteps[from].email = body;
      userSteps[from].step = "company";
      await sendMessage(sock, from, "Perfecto. ¿Para qué empresa trabajas?");
      break;

    case "company":
      userSteps[from].company = body;
      userSteps[from].step = "software";
      await sendMessage(sock, from, "¿Qué software estás utilizando?");
      break;

    case "software":
      userSteps[from].software = body;
      userSteps[from].step = "description";
      await sendMessage(
        sock,
        from,
        "Describe el problema que estás experimentando."
      );
      break;

    case "description":
      userSteps[from].description = body;
      await confirmSupportData(sock, from);
      break;
  }
}

// Función para confirmar los datos y finalizar el flujo
async function confirmSupportData(sock: any, from: string) {
  const { name, email, company, software, description } = userSteps[from];
  const phoneNumber = from.split("@")[0]; // Extraer el número de teléfono

  const confirmationMessage =
    `Gracias ${name}, hemos recibido tu solicitud de soporte.\n\n` +
    `Detalles proporcionados:\n` +
    `Nombre: ${name}\n` +
    `Correo: ${email}\n` +
    `Empresa: ${company}\n` +
    `Software: ${software}\n` +
    `Descripción: ${description}\n` +
    `Número de teléfono: ${phoneNumber}\n\n` +
    `Un representante de soporte se pondrá en contacto contigo pronto.`;

  await sendMessage(sock, from, confirmationMessage);

  // Limpiar el flujo del usuario
  delete userSteps[from];
}

// Función para enviar un saludo inicial y mostrar las opciones
async function sendGreeting(sock: any, from: string) {
  const greetingMessage =
    "Hola, ¿cómo te podemos ayudar hoy? Por favor selecciona una opción respondiendo con el número correspondiente:\n" +
    "1. Soporte Técnico";

  await sendMessage(sock, from, greetingMessage);
}
