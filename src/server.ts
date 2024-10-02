import express, { Request, Response } from "express";

const app = express();
const port = 3000;

// Ruta para verificar el estado del bot
app.get("/status", (req: Request, res: Response) => {
  res.send("El bot de WhatsApp está funcionando correctamente.");
});

export function startServer() {
  app.listen(port, () => {
    console.log(`Servidor Express ejecutándose en http://localhost:${port}`);
  });
}
