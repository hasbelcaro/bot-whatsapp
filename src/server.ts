import express, { Request, Response } from "express";
import path from "path";

const app = express();
const port = 3000;

// Servir archivos estáticos desde la carpeta "public"
app.use(express.static(path.join(__dirname, "../public")));

// Ruta para verificar el estado del bot
app.get("/status", (req: Request, res: Response) => {
  res.send("El bot de WhatsApp está funcionando correctamente.");
});

export function startServer() {
  app.listen(port, () => {
    console.log(`Servidor Express ejecutándose en http://localhost:${port}`);
  });
}
