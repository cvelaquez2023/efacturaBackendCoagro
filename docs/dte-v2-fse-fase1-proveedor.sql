/* =====================================================================
   DTE v2.0 - Sujeto Excluido (DTE 14) - FASE 1: dte_proveedor
   Ejecutar por bloques, primero en pruebas.

   Qué cambia (aditivo, no rompe v1):
   - Se conservan TODAS las columnas actuales con sus mismos valores
     (el formulario de Sujeto Excluido las lee por nombre):
       PROVEEDOR, CONTRIBUYENTE, NOMBRE, DIRECCION, DIVISION_GEOGRAFICA1,
       DIVISION_GEOGRAFICA2, DIVISION_GEOGRAFICA3, TELEFONO1, E_MAIL
   - Columnas nuevas, ya en el formato del esquema FSE v2 (receptor):
       DEPTO_MH      '06'   (CAT-012)
       MUNI_MH       '23'   (CAT-013)  <- RIGHT(DIVISION_GEOGRAFICA2, 2)
       DISTRITO_MH   '14'   (CAT-008)  <- RIGHT(DIVISION_GEOGRAFICA3, 2)
       DIRECCION_MH  complemento sin "DETALLE:", 1..200 caracteres
       TELEFONO_MH   NULL si tiene menos de 8 caracteres (v2: null o 8..30)
       CORREO_MH     NULL si tiene menos de 6 o no trae "@" (v2: null o 6..100)
       PROBLEMA_MH   NULL si está listo para v2; si no, el motivo
   - Esquema dinámico con QUOTENAME (como dte_Cliente): ya no depende de
     la lista fija CINCOH / MOMOS / houdelot / H5.
   - Esquema inexistente: no devuelve filas (igual que antes), sin error.

   Códigos del ERP (catálogo erpadmin.DIVISION_GEOGRAFICA3, PAIS = 'ESA'):
     DIVISION_GEOGRAFICA1 = depto        '06'
     DIVISION_GEOGRAFICA2 = depto+muni   '0623' -> municipio MH '23'
     DIVISION_GEOGRAFICA3 = depto+dist   '0614' -> distrito  MH '14'
   ===================================================================== */


/* ---------------------------------------------------------------------
   BLOQUE 0. Verificación previa (solo lectura)
   Las 4 columnas deben dar un número (no NULL). Si alguna da NULL, ese
   esquema no tiene DIVISION_GEOGRAFICA3 en PROVEEDOR: avisar antes de seguir.
   --------------------------------------------------------------------- */
SELECT COL_LENGTH('COAGRO2.CINCOH.PROVEEDOR',   'DIVISION_GEOGRAFICA3') AS CINCOH,
       COL_LENGTH('COAGRO2.momos.PROVEEDOR',    'DIVISION_GEOGRAFICA3') AS MOMOS,
       COL_LENGTH('COAGRO2.houdelot.PROVEEDOR', 'DIVISION_GEOGRAFICA3') AS HOUDELOT,
       COL_LENGTH('COAGRO2.H5.PROVEEDOR',       'DIVISION_GEOGRAFICA3') AS H5;
GO


/* ---------------------------------------------------------------------
   BLOQUE 1. Procedimiento corregido
   --------------------------------------------------------------------- */
USE [DTE]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

ALTER PROCEDURE [dbo].[dte_proveedor]
    @nit     NVARCHAR(20),
    @esquema NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    -- Esquema sin tabla PROVEEDOR: sin filas, igual que antes (la API responde "no existe")
    IF OBJECT_ID(N'COAGRO2.' + QUOTENAME(@esquema) + N'.PROVEEDOR', N'U') IS NULL
        RETURN;

    DECLARE @sql NVARCHAR(MAX) = N'
    SELECT
        -- Columnas actuales (v1): mismos nombres y valores
        P.PROVEEDOR,
        P.CONTRIBUYENTE,
        P.NOMBRE,
        P.DIRECCION,
        P.DIVISION_GEOGRAFICA1,
        P.DIVISION_GEOGRAFICA2,
        P.DIVISION_GEOGRAFICA3,
        P.TELEFONO1,
        P.E_MAIL,

        -- Formato MH v2 (receptor del DTE 14)
        T.D1                                   AS DEPTO_MH,
        RIGHT(T.D2, 2)                         AS MUNI_MH,
        RIGHT(T.D3, 2)                         AS DISTRITO_MH,
        LEFT(T.DIR, 200)                       AS DIRECCION_MH,
        CASE WHEN LEN(T.TEL) >= 8 THEN LEFT(T.TEL, 30) END              AS TELEFONO_MH,
        CASE WHEN LEN(T.MAIL) >= 6 AND CHARINDEX(''@'', T.MAIL) > 1
             THEN LEFT(T.MAIL, 100) END                                AS CORREO_MH,
        CASE
            WHEN T.D1 IS NULL                  THEN ''SIN DEPARTAMENTO''
            WHEN T.D2 IS NULL                  THEN ''SIN MUNICIPIO''
            WHEN T.D3 IS NULL                  THEN ''SIN DISTRITO''
            WHEN G.DIVISION_GEOGRAFICA3 IS NULL THEN ''DISTRITO NO EXISTE EN CATALOGO''
            WHEN T.DIR IS NULL                 THEN ''SIN DIRECCION''
        END                                    AS PROBLEMA_MH
    FROM COAGRO2.' + QUOTENAME(@esquema) + N'.PROVEEDOR P
    CROSS APPLY (
        SELECT
            NULLIF(LTRIM(RTRIM(P.DIVISION_GEOGRAFICA1)), '''')                         AS D1,
            NULLIF(LTRIM(RTRIM(P.DIVISION_GEOGRAFICA2)), '''')                         AS D2,
            NULLIF(LTRIM(RTRIM(P.DIVISION_GEOGRAFICA3)), '''')                         AS D3,
            NULLIF(LTRIM(RTRIM(REPLACE(P.DIRECCION, ''DETALLE:'', ''''))), '''')       AS DIR,
            NULLIF(LTRIM(RTRIM(P.TELEFONO1)), '''')                                    AS TEL,
            NULLIF(LTRIM(RTRIM(P.E_MAIL)), '''')                                       AS MAIL
    ) T
    -- El distrito debe existir en el catálogo con ese depto y municipio
    LEFT JOIN COAGRO2.erpadmin.DIVISION_GEOGRAFICA3 G
           ON G.PAIS = ''ESA''
          AND G.DIVISION_GEOGRAFICA1 = T.D1
          AND G.DIVISION_GEOGRAFICA2 = T.D2
          AND G.DIVISION_GEOGRAFICA3 = T.D3
    WHERE REPLACE(P.CONTRIBUYENTE, ''-'', '''') = REPLACE(@nit, ''-'', '''')
    ORDER BY P.PROVEEDOR;';

    EXEC sp_executesql @sql, N'@nit NVARCHAR(20)', @nit;
END
GO


/* ---------------------------------------------------------------------
   BLOQUE 2. Pruebas (solo lectura)
   Debe traer las columnas de siempre + las _MH. PROBLEMA_MH = NULL si está listo.
   --------------------------------------------------------------------- */
-- EXEC DTE.dbo.dte_proveedor '<DUI o NIT de un proveedor>', 'CINCOH';
-- EXEC DTE.dbo.dte_proveedor '<DUI o NIT de un proveedor>', 'MOMOS';
-- Esquema inexistente: no debe devolver filas ni error
-- EXEC DTE.dbo.dte_proveedor '00000000-0', 'NOEXISTE';


/* ---------------------------------------------------------------------
   BLOQUE 3. Diagnóstico: proveedores de Sujeto Excluido NO listos para v2
   (los que ya tienen DTE 14 emitidos en dte.dbo.subjetoExcluido).
   Cambiar CINCOH por el esquema que se revisa.
   --------------------------------------------------------------------- */
WITH usados AS (
    SELECT DISTINCT REPLACE(s.nit, '-', '') AS doc
      FROM dte.dbo.DTES d
      JOIN dte.dbo.subjetoExcluido s ON s.dte_id = d.Dte_Id
     WHERE d.tipoDoc = '14'
)
SELECT P.PROVEEDOR, P.CONTRIBUYENTE, P.NOMBRE,
       P.DIVISION_GEOGRAFICA1 AS D1, P.DIVISION_GEOGRAFICA2 AS D2, P.DIVISION_GEOGRAFICA3 AS D3,
       CASE
         WHEN NULLIF(LTRIM(RTRIM(P.DIVISION_GEOGRAFICA1)), '') IS NULL THEN 'SIN DEPARTAMENTO'
         WHEN NULLIF(LTRIM(RTRIM(P.DIVISION_GEOGRAFICA2)), '') IS NULL THEN 'SIN MUNICIPIO'
         WHEN NULLIF(LTRIM(RTRIM(P.DIVISION_GEOGRAFICA3)), '') IS NULL THEN 'SIN DISTRITO'
         WHEN G.DIVISION_GEOGRAFICA3 IS NULL                           THEN 'DISTRITO NO EXISTE EN CATALOGO'
         WHEN NULLIF(LTRIM(RTRIM(REPLACE(P.DIRECCION, 'DETALLE:', ''))), '') IS NULL THEN 'SIN DIRECCION'
       END AS PROBLEMA_MH
  FROM COAGRO2.CINCOH.PROVEEDOR P
  JOIN usados U ON U.doc = REPLACE(P.CONTRIBUYENTE, '-', '')
  LEFT JOIN COAGRO2.erpadmin.DIVISION_GEOGRAFICA3 G
         ON G.PAIS = 'ESA'
        AND G.DIVISION_GEOGRAFICA1 = LTRIM(RTRIM(P.DIVISION_GEOGRAFICA1))
        AND G.DIVISION_GEOGRAFICA2 = LTRIM(RTRIM(P.DIVISION_GEOGRAFICA2))
        AND G.DIVISION_GEOGRAFICA3 = LTRIM(RTRIM(P.DIVISION_GEOGRAFICA3))
 WHERE NULLIF(LTRIM(RTRIM(P.DIVISION_GEOGRAFICA1)), '') IS NULL
    OR NULLIF(LTRIM(RTRIM(P.DIVISION_GEOGRAFICA2)), '') IS NULL
    OR NULLIF(LTRIM(RTRIM(P.DIVISION_GEOGRAFICA3)), '') IS NULL
    OR G.DIVISION_GEOGRAFICA3 IS NULL
    OR NULLIF(LTRIM(RTRIM(REPLACE(P.DIRECCION, 'DETALLE:', ''))), '') IS NULL
 ORDER BY PROBLEMA_MH, P.NOMBRE;
GO


/* ---------------------------------------------------------------------
   BLOQUE 4. REVERSIÓN: volver a la versión anterior (con lista fija de esquemas)
   --------------------------------------------------------------------- */
/*
USE [DTE]
GO
ALTER PROCEDURE [dbo].[dte_proveedor]
@nit NVARCHAR(20),
@esquema nvarchar(50)
AS
SET NOCOUNT ON;
IF @esquema='CINCOH'
BEGIN
SELECT PROVEEDOR,CONTRIBUYENTE,NOMBRE,DIRECCION,DIVISION_GEOGRAFICA1,DIVISION_GEOGRAFICA2,DIVISION_GEOGRAFICA3, TELEFONO1,E_MAIL FROM COAGRO2.CINCOH.PROVEEDOR WHERE replace(CONTRIBUYENTE,'-','')=replace(@nit,'-','')
END
IF @esquema='MOMOS'
BEGIN
SELECT PROVEEDOR,CONTRIBUYENTE,NOMBRE,DIRECCION,DIVISION_GEOGRAFICA1,DIVISION_GEOGRAFICA2,DIVISION_GEOGRAFICA3,TELEFONO1,E_MAIL FROM COAGRO2.momos.PROVEEDOR WHERE replace(CONTRIBUYENTE,'-','')=replace(@nit,'-','')
END
IF @esquema='houdelot'
BEGIN
SELECT PROVEEDOR,CONTRIBUYENTE,NOMBRE,DIRECCION,DIVISION_GEOGRAFICA1,DIVISION_GEOGRAFICA2,DIVISION_GEOGRAFICA3,TELEFONO1,E_MAIL FROM COAGRO2.houdelot.PROVEEDOR WHERE replace(CONTRIBUYENTE,'-','')=replace(@nit,'-','')
END
IF @esquema='H5'
BEGIN
SELECT PROVEEDOR,CONTRIBUYENTE,NOMBRE,DIRECCION,DIVISION_GEOGRAFICA1,DIVISION_GEOGRAFICA2,DIVISION_GEOGRAFICA3,TELEFONO1,E_MAIL FROM COAGRO2.H5.PROVEEDOR WHERE replace(CONTRIBUYENTE,'-','')=replace(@nit,'-','')
END
  RETURN;
GO
*/
