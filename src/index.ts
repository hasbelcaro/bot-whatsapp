import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  proto,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import * as qrcode from "qrcode-terminal";

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    getMessage: async (key) => {
      return undefined;
    },
  });

  // Manejar el estado de la conexión
  sock.ev.on("connection.update", (update) => {
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
      qrcode.generate(qr, { small: true });
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

    // Si es el primer mensaje o si el usuario dice "hola"
    if (!body || body.toLowerCase() === "hola") {
      // El bot responde con el mensaje de bienvenida y opciones
      await sendButtonMessage(sock, from);
    } else if (body === "1") {
      await sendMessage(
        sock,
        from,
        "Aquí tienes información sobre nuestros productos..."
      );
    } else if (body === "2") {
      await sendMessage(sock, from, "Conectándote con soporte técnico...");
    } else {
      await sendMessage(
        sock,
        from,
        "No entendí tu respuesta. Por favor elige una opción:"
      );
      await sendButtonMessage(sock, from);
    }
  });
}

// Función auxiliar para enviar botones simplificados
async function sendButtonMessage(sock: any, jid: string) {
  const buttons = [
    {
      buttonId: "1",
      buttonText: { displayText: "Información sobre productos" },
      type: 1,
    },
    { buttonId: "2", buttonText: { displayText: "Soporte técnico" }, type: 1 },
  ];

  const buttonMessage = {
    text: "¡Hola! Gracias por comunicarte con nosotros. Elige una opción:",
    buttons: buttons, // Solo los botones sin headers ni footers
    headerType: 1, // Encabezado de tipo texto
  };

  await sock.sendMessage(jid, buttonMessage);
}

// Función auxiliar para enviar mensajes de texto simples
async function sendMessage(sock: any, jid: string, content: string) {
  const message = { text: content };
  await sock.sendMessage(jid, message);
}

// Iniciar el bot
startBot().catch((err) => console.error("Error al iniciar el bot:", err));
