import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  proto,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import * as qrcode from "qrcode-terminal";

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

    // Omitir mensajes provenientes de grupos
    if (from.endsWith("@g.us")) {
      console.log("Mensaje de grupo ignorado:", from);
      return; // Ignorar el mensaje y no continuar procesándolo
    }

    const body =
      message.message.conversation ||
      message.message.extendedTextMessage?.text ||
      "";

    console.log(`Mensaje de ${from}: ${body}`);

    // Si es el primer mensaje o si el usuario dice "hola"
    if (!body || body.toLowerCase() === "hola") {
      await sendMessage(
        sock,
        from,
        "¡Hola! Gracias por comunicarte con nosotros."
      );
    }
  });
}

// Función auxiliar para enviar mensajes de texto (también exportada)
export async function sendMessage(sock: any, jid: string, content: string) {
  const message = { text: content };
  await sock.sendMessage(jid, message);
}
