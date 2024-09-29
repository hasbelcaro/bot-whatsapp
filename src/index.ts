import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  AnyMessageContent,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import * as qrcode from "qrcode-terminal";

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    // Si no necesitas la funcionalidad getMessage, simplemente retornamos undefined
    getMessage: async (key) => {
      // Podrías implementar lógica aquí para obtener un mensaje si lo necesitas.
      return undefined; // Retorna undefined como el valor esperado.
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
        startBot();
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

    // Flujo del chatbot
    if (body === "1") {
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
        "¡Hola! Gracias por comunicarte con nosotros. Elige una opción:\n1️⃣ Información sobre productos\n2️⃣ Soporte técnico"
      );
    }
  });
}

// Función auxiliar para enviar mensajes
async function sendMessage(sock: any, jid: string, content: string) {
  const message: AnyMessageContent = { text: content };
  await sock.sendMessage(jid, message);
}

// Iniciar el bot
startBot().catch((err) => console.error("Error al iniciar el bot:", err));
