-- Renombrado de tres asignaciones de "Seamos mejores maestros" a su forma en
-- primera persona del plural. Es SOLO un cambio de texto: la parte es la misma.
--
-- Se renombra TODO el historial, no solo lo nuevo, a proposito: la recencia y el
-- aviso de "ya hizo esta parte" emparejan por el texto exacto de `asignacion`
-- (ver /api/roster), y los chips de "Frecuentes" se derivan de los registros. Si
-- convivieran las dos grafias, cada parte saldria duplicada en las sugerencias y
-- el historial de cada persona se partiria en dos.
--
-- Afecta a 131 filas (79 + 35 + 17), todas con fecha pasada.
-- Idempotente: solo toca las filas que aun tengan el nombre viejo.

UPDATE "Record" SET "asignacion" = 'Empecemos conversaciones' WHERE "asignacion" = 'Empiece conversaciones';
UPDATE "Record" SET "asignacion" = 'Hagamos revisitas'        WHERE "asignacion" = 'Haga revisitas';
UPDATE "Record" SET "asignacion" = 'Hagamos discípulos'       WHERE "asignacion" = 'Haga discípulos';
