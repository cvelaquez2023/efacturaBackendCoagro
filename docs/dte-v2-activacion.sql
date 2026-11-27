/* =====================================================================
   DTE v2.0 (Normativa MH) - FASE 6: activar v2 por empresa
   ---------------------------------------------------------------------
   El código arma JSON v2 cuando las columnas de versión de la empresa
   llegan a la versión nueva (esV2 en config/MH.js). Este script es el
   "interruptor": respalda las versiones actuales, activa v2 y permite
   volver atrás.

   Orden recomendado:
     1. Ejecutar primero docs/dte-v2-fase1.sql (columnas y dte_Cliente).
     2. Empresa en AMBIENTE DE PRUEBAS (ambiente = '00'): bloques 0 a 3.
     3. Emitir uno de cada tipo y revisar (bloque 4).
     4. Repetir en producción (ambiente = '01') antes del 2026-12-01.
     5. Si algo falla: bloque 5 (reversión) y reiniciar la API no es
        necesario (Sqlempresa se consulta en cada emisión).

   Ajustar @empresa y @ambiente en CADA bloque antes de ejecutar.
   ===================================================================== */


/* ---------------------------------------------------------------------
   BLOQUE 0. Verificaciones previas (no cambia nada)
   Todo debe salir 'OK'. Si algo sale 'FALTA', no activar.
   --------------------------------------------------------------------- */
DECLARE @empresa INT = 1;          -- <-- Empresa_id
SELECT 'empresa.distrito'               AS chequeo, CASE WHEN COL_LENGTH('DTE.dbo.empresa','distrito')               IS NULL THEN 'FALTA' ELSE 'OK' END AS estado
UNION ALL SELECT 'emisor.direccion_dist',          CASE WHEN COL_LENGTH('dte.dbo.emisor','direccion_dist')          IS NULL THEN 'FALTA' ELSE 'OK' END
UNION ALL SELECT 'receptor.direccion_dist',        CASE WHEN COL_LENGTH('dte.dbo.receptor','direccion_dist')        IS NULL THEN 'FALTA' ELSE 'OK' END
UNION ALL SELECT 'subjetoExcluido.direccion_dist', CASE WHEN COL_LENGTH('dte.dbo.subjetoExcluido','direccion_dist') IS NULL THEN 'FALTA' ELSE 'OK' END
UNION ALL SELECT 'dte_Cliente devuelve DISTRITO_MH',
          CASE WHEN OBJECT_DEFINITION(OBJECT_ID('dte.dbo.dte_Cliente')) LIKE '%DISTRITO_MH%' THEN 'OK' ELSE 'FALTA' END
UNION ALL SELECT 'empresa con distrito',
          CASE WHEN EXISTS (SELECT 1 FROM DTE.dbo.empresa
                             WHERE Empresa_id = @empresa
                               AND NULLIF(LTRIM(RTRIM(distrito)), '') IS NOT NULL) THEN 'OK' ELSE 'FALTA' END;

-- Versiones y datos actuales de la empresa
SELECT Empresa_id, nombre, esquemaBD, ambiente, departamento, municipio, distrito,
       codestableceMh, codPuntoVentaMh,
       versionDte01, versionDte03, versionDte05, versionDte06, versionDte07,
       versionDte11, versionDte14, versionInva, versionConting
  FROM DTE.dbo.empresa
 WHERE Empresa_id = @empresa;
GO


/* ---------------------------------------------------------------------
   BLOQUE 1. Tabla de respaldo de versiones (se crea una sola vez)
   --------------------------------------------------------------------- */
IF OBJECT_ID('DTE.dbo.empresa_versiones_respaldo') IS NULL
CREATE TABLE DTE.dbo.empresa_versiones_respaldo (
    respaldo_id    INT IDENTITY(1,1) PRIMARY KEY,
    Empresa_id     INT          NOT NULL,
    ambiente       VARCHAR(2)   NULL,
    versionDte01   INT NULL, versionDte03 INT NULL, versionDte05 INT NULL,
    versionDte06   INT NULL, versionDte07 INT NULL, versionDte11 INT NULL,
    versionDte14   INT NULL, versionInva  INT NULL, versionConting INT NULL,
    fecha          DATETIME     NOT NULL DEFAULT GETDATE(),
    usuario        SYSNAME      NOT NULL DEFAULT SUSER_SNAME(),
    nota           VARCHAR(100) NULL
);
GO


/* ---------------------------------------------------------------------
   BLOQUE 2. Respaldar y ACTIVAR v2
   Solo actúa si la empresa está en el ambiente indicado (evita activar
   producción por error). Todo en una transacción.
   --------------------------------------------------------------------- */
DECLARE @empresa  INT        = 1;     -- <-- Empresa_id
DECLARE @ambiente VARCHAR(2) = '00';  -- <-- '00' pruebas / '01' producción

BEGIN TRAN;

IF NOT EXISTS (SELECT 1 FROM DTE.dbo.empresa WHERE Empresa_id = @empresa AND ambiente = @ambiente)
BEGIN
    ROLLBACK;
    RAISERROR('La empresa no existe o no está en el ambiente indicado. No se activó nada.', 16, 1);
    RETURN;
END

INSERT INTO DTE.dbo.empresa_versiones_respaldo
       (Empresa_id, ambiente, versionDte01, versionDte03, versionDte05, versionDte06,
        versionDte07, versionDte11, versionDte14, versionInva, versionConting, nota)
SELECT Empresa_id, ambiente, versionDte01, versionDte03, versionDte05, versionDte06,
       versionDte07, versionDte11, versionDte14, versionInva, versionConting,
       'Antes de activar DTE v2.0'
  FROM DTE.dbo.empresa
 WHERE Empresa_id = @empresa;

-- Versiones Normativa DTE v2.0 (esquemas oficiales MH 2026)
--   01 FE = 2 | 03 CCF, 05 NC, 06 ND = 4 | 07 CR = 2 | 11 FEX = 3 | 14 FSE = 2
--   Invalidación = 3 | Contingencia = 4
-- Nota: identificacion() usa versionDte03 también para 04 y 05.
UPDATE DTE.dbo.empresa
   SET versionDte01   = 2,
       versionDte03   = 4,
       versionDte05   = 4,
       versionDte06   = 4,
       versionDte07   = 2,
       versionDte11   = 3,
       versionDte14   = 2,
       versionInva    = 3,
       versionConting = 4
 WHERE Empresa_id = @empresa
   AND ambiente   = @ambiente;

COMMIT;

SELECT 'ACTIVADO' AS resultado, Empresa_id, ambiente,
       versionDte01, versionDte03, versionDte05, versionDte11, versionDte14,
       versionInva, versionConting
  FROM DTE.dbo.empresa
 WHERE Empresa_id = @empresa;
GO


/* ---------------------------------------------------------------------
   BLOQUE 3. Confirmar respaldo guardado
   --------------------------------------------------------------------- */
SELECT TOP 5 * FROM DTE.dbo.empresa_versiones_respaldo ORDER BY respaldo_id DESC;
GO


/* ---------------------------------------------------------------------
   BLOQUE 4. Seguimiento de las emisiones después de activar
   Ajustar la fecha. Revisar también logs/combined.log: el validador
   local escribe "no cumple el esquema MH" con el detalle del error.
   --------------------------------------------------------------------- */
DECLARE @empresa INT      = 1;              -- <-- Empresa_id
DECLARE @desde   DATETIME = '2026-11-27';   -- <-- desde cuándo revisar

-- Estado por tipo de documento
SELECT tipoDoc, estado, COUNT(*) AS cantidad
  FROM dte.dbo.dtes
 WHERE Empresa_id = @empresa AND fechaemision >= @desde
 GROUP BY tipoDoc, estado
 ORDER BY tipoDoc, estado;

-- Detalle de rechazados con las observaciones de Hacienda
SELECT d.Dte_id, d.dte, d.tipoDoc, d.estado, d.fechaemision, o.descripcion AS observacionMH
  FROM dte.dbo.dtes d
  LEFT JOIN dte.dbo.observaciones o ON o.dte_id = d.Dte_id
 WHERE d.Empresa_id = @empresa
   AND d.fechaemision >= @desde
   AND d.estado <> 'PROCESADO'
 ORDER BY d.Dte_id DESC;

-- Distrito guardado en emisor/receptor de lo emitido (debe venir lleno en v2)
SELECT TOP 20 d.dte, d.tipoDoc, e.direccion_dist AS distEmisor, r.direccion_dist AS distReceptor
  FROM dte.dbo.dtes d
  LEFT JOIN dte.dbo.emisor   e ON e.dte_Id = d.Dte_id
  LEFT JOIN dte.dbo.receptor r ON r.dte_Id = d.Dte_id
 WHERE d.Empresa_id = @empresa AND d.fechaemision >= @desde
 ORDER BY d.Dte_id DESC;
GO


/* ---------------------------------------------------------------------
   BLOQUE 5. REVERSIÓN: volver a las versiones respaldadas
   Usa el último respaldo de la empresa. Después del 2026-12-01 Hacienda
   ya no acepta v1: usar solo para salir de un problema puntual.
   --------------------------------------------------------------------- */
/*
DECLARE @empresa INT = 1;   -- <-- Empresa_id

BEGIN TRAN;

UPDATE e
   SET e.versionDte01   = r.versionDte01,
       e.versionDte03   = r.versionDte03,
       e.versionDte05   = r.versionDte05,
       e.versionDte06   = r.versionDte06,
       e.versionDte07   = r.versionDte07,
       e.versionDte11   = r.versionDte11,
       e.versionDte14   = r.versionDte14,
       e.versionInva    = r.versionInva,
       e.versionConting = r.versionConting
  FROM DTE.dbo.empresa e
  JOIN (SELECT TOP 1 * FROM DTE.dbo.empresa_versiones_respaldo
         WHERE Empresa_id = @empresa ORDER BY respaldo_id DESC) r
    ON r.Empresa_id = e.Empresa_id;

COMMIT;

SELECT 'REVERTIDO' AS resultado, Empresa_id, versionDte01, versionDte03, versionDte11,
       versionDte14, versionInva, versionConting
  FROM DTE.dbo.empresa WHERE Empresa_id = @empresa;
*/
