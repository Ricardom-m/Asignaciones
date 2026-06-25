// Zona horaria de la congregación. "Hoy" se ancla aquí (no a UTC) para que las
// etiquetas Hoy / Próxima / Pasada (y "mañana/ayer") sean correctas incluso de
// noche, cuando UTC ya pasó al día siguiente. Compartido por cliente y servidor.
export const TZ = "America/Mexico_City";

// Fecha de "hoy" en la zona de la congregación, como "YYYY-MM-DD".
export const todayYMD = (): string =>
  new Date().toLocaleDateString("en-CA", { timeZone: TZ });
