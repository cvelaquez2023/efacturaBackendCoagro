/* =====================================================================
   DTE v2.0 (Normativa MH) - FASE 1: datos y base de datos
   Ejecutar por bloques, primero en pruebas. Todos los cambios son
   aditivos: no alteran lo que hoy se envía en v1.

   Códigos geográficos (CAT-012/013/008):
     ERP erpadmin.CLIENTE_CIA:
       DIVISION_GEOGRAFICA1  = departamento  '06'
       DIVISION_GEOGRAFICA2  = depto+muni    '0623'  -> MH municipio '23'
       division_geografica3  = depto+dist    '0614'  -> MH distrito  '14'
   ===================================================================== */

/* ---------------------------------------------------------------------
   BLOQUE 1. Empresa (emisor): agregar distrito
   COAGRO: 67 Av. Sur #142, San Salvador Centro, distrito San Salvador
           departamento 06, municipio 23, distrito 14
   --------------------------------------------------------------------- */
IF COL_LENGTH('DTE.dbo.empresa', 'distrito') IS NULL
    ALTER TABLE DTE.dbo.empresa ADD distrito VARCHAR(2) NULL;
GO

-- Revisar valores actuales antes de actualizar
SELECT Empresa_id, nombre, esquemaBD, departamento, municipio, complementoDir
FROM DTE.dbo.empresa;

-- Ajustar Empresa_id. El municipio también cambia al código nuevo (CAT-013).
-- UPDATE DTE.dbo.empresa SET departamento = '06', municipio = '23', distrito = '14'
--  WHERE Empresa_id = ?;
GO

/* ---------------------------------------------------------------------
   BLOQUE 2. Tablas históricas del DTE: guardar distrito
   --------------------------------------------------------------------- */
IF COL_LENGTH('dte.dbo.emisor', 'direccion_dist') IS NULL
    ALTER TABLE dte.dbo.emisor ADD direccion_dist VARCHAR(2) NULL;
IF COL_LENGTH('dte.dbo.receptor', 'direccion_dist') IS NULL
    ALTER TABLE dte.dbo.receptor ADD direccion_dist VARCHAR(2) NULL;
GO

-- Agregado en Fase 3 (Sujeto Excluido, DTE 14)
IF COL_LENGTH('dte.dbo.subjetoExcluido', 'direccion_dist') IS NULL
    ALTER TABLE dte.dbo.subjetoExcluido ADD direccion_dist VARCHAR(2) NULL;
GO

/* ---------------------------------------------------------------------
   BLOQUE 3. dte_Cliente: devolver depto/municipio/distrito en formato MH
   Columnas nuevas (no se quita ninguna; ZONA se mantiene para v1):
     DEPTO_MH, MUNI_MH, DISTRITO_MH
   CLIENTE_CIA: se prefiere COD_CIA = @esquema; si no existe, la primera.
   --------------------------------------------------------------------- */
ALTER PROCEDURE [dbo].[dte_Cliente]
@cliente varchar(50),
@esquema varchar(50)
as
begin
 SET NOCOUNT ON;
   DECLARE @sql NVARCHAR(MAX);

 set @sql= N'   SELECT                  C.CLIENTE,
                    REPLACE(C.NOMBRE, '''', '''') AS NOMBRE,
                    REPLACE(C.ALIAS, '''', '''') AS ALIAS,
                    C.CONTACTO,
                    C.CARGO,
                    C.DIRECCION,
                    C.TELEFONO1,
                    REPLACE(C.CONTRIBUYENTE, ''-'', '''') AS CONTRIBUYENTE,
                    C.FECHA_INGRESO,
                    C.MULTIMONEDA,
                    C.MONEDA,
                    C.SALDO,
                    C.SALDO_LOCAL,
                    C.SALDO_DOLAR,
                    C.SALDO_CREDITO,
                    C.EXCEDER_LIMITE,
                    C.TASA_INTERES,
                    C.TASA_INTERES_MORA,
                    C.FECHA_ULT_MOV,
                    C.CONDICION_PAGO,
                    C.NIVEL_PRECIO,
                    C.DESCUENTO,
                    C.MONEDA_NIVEL,
                    C.ACEPTA_BACKORDER,
                    C.PAIS,
                    C.ZONA,
                    C.RUTA,
                    C.VENDEDOR,
                    C.COBRADOR,
                    C.ACEPTA_FRACCIONES,
                    C.ACTIVO,
                    C.EXENTO_IMPUESTOS,
                    C.EXENCION_IMP1,
                    C.EXENCION_IMP2,
                    C.COBRO_JUDICIAL,
                    C.CATEGORIA_CLIENTE,
                    C.CLASE_ABC,
                    C.DIAS_ABASTECIMIEN,
                    C.USA_TARJETA,
                    C.TARJETA_CREDITO,
                    C.FECHA_VENCE_TARJ,
                    C.E_MAIL,
                    C.REQUIERE_OC,
                    C.ES_CORPORACION,
                    C.REGISTRARDOCSACORP,
                    C.USAR_DIREMB_CORP,
                    C.APLICAC_ABIERTAS,
                    C.VERIF_LIMCRED_CORP,
                    C.USAR_DESC_CORP,
                    C.DOC_A_GENERAR,
                    C.TIENE_CONVENIO,
                    C.NOTAS,
                    C.DIAS_PROMED_ATRASO,
                    C.ASOCOBLIGCONTFACT,
                    C.USAR_PRECIOS_CORP,
                    C.USAR_EXENCIMP_CORP,
                    C.AJUSTE_FECHA_COBRO,
                    C.CLASE_DOCUMENTO,
                    C.LOCAL,
                    C.TIPO_CONTRIBUYENTE,
                    C.ACEPTA_DOC_ELECTRONICO,
                    C.CONFIRMA_DOC_ELECTRONICO,
                    C.ACEPTA_DOC_EDI,
                    C.NOTIFICAR_ERROR_EDI,
                    C.CODIGO_IMPUESTO,
                    C.MOROSO,
                    C.MODIF_NOMB_EN_FAC,
                    C.SALDO_TRANS,
                    C.SALDO_TRANS_DOLAR,
                    C.PERMITE_DOC_GP,
                    C.PARTICIPA_FLUJOCAJA,
                    C.DETALLAR_KITS,
                    C.ES_EXTRANJERO,
                    C.ES_AGENTE_PERCEPCION,
                    C.ES_BUEN_CONTRIBUYENTE,
                    '''' AS SUJETO_PORCE_SUNAT,
                    REPLACE(C.RUBRO4_CLI, ''-'', '''') AS NRC,
                    C.RUBRO2_CLI,
                    C.RUBRO3_CLI,
                    C.RUBRO4_CLI,
                    C.RUBRO5_CLI,
                    C.RUBRO7_CLIENTE AS CORREODTE,
                    C.RUBRO8_CLIENTE AS CODACT,
                    C.RUBRO9_CLIENTE AS DESCACT,
                    NULLIF(LTRIM(RTRIM(CC.DIVISION_GEOGRAFICA1)), '''')            AS DEPTO_MH,
                    NULLIF(RIGHT(LTRIM(RTRIM(CC.DIVISION_GEOGRAFICA2)), 2), '''')  AS MUNI_MH,
                    NULLIF(RIGHT(LTRIM(RTRIM(CC.division_geografica3)), 2), '''')  AS DISTRITO_MH
                FROM
                    COAGRO2.' + QUOTENAME(@esquema) + '.CLIENTE C
                OUTER APPLY (
                    SELECT TOP 1 X.DIVISION_GEOGRAFICA1, X.DIVISION_GEOGRAFICA2, X.division_geografica3
                      FROM COAGRO2.erpadmin.CLIENTE_CIA X
                     WHERE X.COD_CLT = C.CLIENTE
                     ORDER BY CASE WHEN X.COD_CIA = @esquema THEN 0 ELSE 1 END, X.COD_CIA
                ) CC
                WHERE
                    C.CLIENTE = @cliente';

    EXEC sp_executesql @sql, N'@cliente VARCHAR(50), @esquema VARCHAR(50)', @cliente, @esquema;
end
GO

-- Prueba: debe traer DEPTO_MH='06', MUNI_MH='23', DISTRITO_MH='14' para un cliente de San Salvador
-- EXEC dte.dbo.dte_Cliente '503035', 'CINCOH';

/* ---------------------------------------------------------------------
   BLOQUE 4. Diagnóstico: clientes facturados sin distrito válido
   Son los que Hacienda rechazaría en v2. Cambiar CINCOH por el esquema.
   --------------------------------------------------------------------- */
SELECT C.CLIENTE, C.NOMBRE, C.ZONA,
       CC.DIVISION_GEOGRAFICA1 AS D1, CC.DIVISION_GEOGRAFICA2 AS D2, CC.division_geografica3 AS D3,
       CASE
         WHEN CC.COD_CLT IS NULL                          THEN 'SIN CLIENTE_CIA'
         WHEN NULLIF(LTRIM(RTRIM(CC.division_geografica3)), '') IS NULL THEN 'SIN DISTRITO'
         WHEN G3.DIVISION_GEOGRAFICA3 IS NULL             THEN 'DISTRITO NO EXISTE EN CATALOGO'
       END AS PROBLEMA
FROM COAGRO2.CINCOH.CLIENTE C
OUTER APPLY (
    SELECT TOP 1 * FROM COAGRO2.erpadmin.CLIENTE_CIA X
     WHERE X.COD_CLT = C.CLIENTE
     ORDER BY CASE WHEN X.COD_CIA = 'CINCOH' THEN 0 ELSE 1 END, X.COD_CIA
) CC
LEFT JOIN COAGRO2.erpadmin.DIVISION_GEOGRAFICA3 G3
       ON G3.PAIS = 'ESA'
      AND G3.DIVISION_GEOGRAFICA1 = LTRIM(RTRIM(CC.DIVISION_GEOGRAFICA1))
      AND G3.DIVISION_GEOGRAFICA2 = LTRIM(RTRIM(CC.DIVISION_GEOGRAFICA2))
      AND G3.DIVISION_GEOGRAFICA3 = LTRIM(RTRIM(CC.division_geografica3))
WHERE C.ACTIVO = 'S'
  AND (CC.COD_CLT IS NULL
       OR NULLIF(LTRIM(RTRIM(CC.division_geografica3)), '') IS NULL
       OR G3.DIVISION_GEOGRAFICA3 IS NULL)
ORDER BY PROBLEMA, C.CLIENTE;

-- Resumen por problema
-- (misma consulta envuelta en SELECT PROBLEMA, COUNT(*) ... GROUP BY PROBLEMA)

/* ---------------------------------------------------------------------
   NO incluido a propósito:
   - Cambiar versionDte01/03/05/07/11/14, versionInva, versionConting.
     Es el "interruptor" de la v2: se hace en la Fase 6, empresa por empresa,
     cuando el código ya esté listo. Valores: 01=2, 03=4, 05=4, 06=4,
     07=2, 11=3, 14=2, versionInva=3, versionConting=4.
   - Tabla resumen: ivaRete1/ivaPerci1/reteRenta se conservan como columnas
     de BD; el cambio de nombre es solo en el JSON (Fase 3).
   --------------------------------------------------------------------- */
