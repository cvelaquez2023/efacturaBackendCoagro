/* =====================================================================
   DTE v2.0 - Sujeto Excluido (DTE 14) - FASE 0: verificación de datos
   SOLO LECTURA: ninguna consulta modifica datos ni objetos.

   Objetivo: saber de dónde sale (o si existe) el distrito del proveedor,
   en qué formato viene el municipio y cuántos proveedores tienen datos
   incompletos para el esquema FSE v2.

   Antes de correr: si el esquema del ERP no es CINCOH
   (DTE.dbo.empresa.esquemaBD), cambiarlo en el BLOQUE 5.
   Correr bloque por bloque y guardar el resultado de cada uno.
   ===================================================================== */


/* ---------------------------------------------------------------------
   BLOQUE 1. ¿Qué devuelve hoy dte_proveedor y de qué tabla lee?
   Copiar el texto completo del procedimiento.
   --------------------------------------------------------------------- */
EXEC DTE.sys.sp_helptext N'dbo.dte_proveedor';


/* ---------------------------------------------------------------------
   BLOQUE 2. Tablas de proveedores del ERP y sus columnas geográficas
   Buscamos DIVISION_GEOGRAFICA3 (distrito) en PROVEEDOR o en una tabla
   tipo PROVEEDOR_CIA (como CLIENTE_CIA para los clientes).
   --------------------------------------------------------------------- */
SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
  FROM COAGRO2.INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_NAME LIKE 'PROVEEDOR%'
   AND (COLUMN_NAME LIKE 'DIVISION_GEOGRAFICA%'
        OR COLUMN_NAME IN ('CONTRIBUYENTE', 'TELEFONO1', 'E_MAIL', 'DIRECCION', 'COD_PROV', 'COD_CIA', 'PAIS'))
 ORDER BY TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME;


/* ---------------------------------------------------------------------
   BLOQUE 3. Lo que ya se emitió como Sujeto Excluido (DTE 14)
   Formato real del municipio guardado ("23" o "0623") y datos de contacto.
   --------------------------------------------------------------------- */
SELECT TOP 30
       d.Dte, CONVERT(date, d.fechaemision) AS fecha, d.estado,
       s.tipoDocumento, s.nit AS documento, s.nombre,
       s.direccion_depa, s.direccion_muni, LEN(s.direccion_muni) AS largo_muni,
       s.telefono, s.correo
  FROM dte.dbo.DTES d
  JOIN dte.dbo.subjetoExcluido s ON s.dte_id = d.Dte_Id
 WHERE d.tipoDoc = '14'
 ORDER BY d.fechaemision DESC, d.Dte DESC;

-- Resumen del formato del municipio guardado
SELECT LEN(s.direccion_muni) AS largo_muni, COUNT(*) AS documentos
  FROM dte.dbo.DTES d
  JOIN dte.dbo.subjetoExcluido s ON s.dte_id = d.Dte_Id
 WHERE d.tipoDoc = '14'
 GROUP BY LEN(s.direccion_muni);


/* ---------------------------------------------------------------------
   BLOQUE 4. Proveedores de Sujeto Excluido con datos que FSE v2 rechaza
   v2 exige: teléfono null o de 8+ caracteres; correo null o de 6+.
   (Un texto vacío "" o corto NO es válido.)
   --------------------------------------------------------------------- */
SELECT CASE
         WHEN s.telefono IS NULL                     THEN 'telefono NULL (ok)'
         WHEN LEN(LTRIM(RTRIM(s.telefono))) = 0      THEN 'telefono VACIO (falla)'
         WHEN LEN(LTRIM(RTRIM(s.telefono))) < 8      THEN 'telefono CORTO (falla)'
         ELSE 'telefono ok'
       END AS telefono,
       CASE
         WHEN s.correo IS NULL                       THEN 'correo NULL (ok)'
         WHEN LEN(LTRIM(RTRIM(s.correo))) = 0        THEN 'correo VACIO (falla)'
         WHEN LEN(LTRIM(RTRIM(s.correo))) < 6        THEN 'correo CORTO (falla)'
         ELSE 'correo ok'
       END AS correo,
       COUNT(DISTINCT s.nit) AS proveedores
  FROM dte.dbo.DTES d
  JOIN dte.dbo.subjetoExcluido s ON s.dte_id = d.Dte_Id
 WHERE d.tipoDoc = '14'
 GROUP BY
       CASE
         WHEN s.telefono IS NULL                     THEN 'telefono NULL (ok)'
         WHEN LEN(LTRIM(RTRIM(s.telefono))) = 0      THEN 'telefono VACIO (falla)'
         WHEN LEN(LTRIM(RTRIM(s.telefono))) < 8      THEN 'telefono CORTO (falla)'
         ELSE 'telefono ok'
       END,
       CASE
         WHEN s.correo IS NULL                       THEN 'correo NULL (ok)'
         WHEN LEN(LTRIM(RTRIM(s.correo))) = 0        THEN 'correo VACIO (falla)'
         WHEN LEN(LTRIM(RTRIM(s.correo))) < 6        THEN 'correo CORTO (falla)'
         ELSE 'correo ok'
       END
 ORDER BY 1, 2;


/* ---------------------------------------------------------------------
   BLOQUE 5. Probar dte_proveedor con proveedores reales
   Tomar 3 o 4 documentos de la columna "documento" del BLOQUE 3
   (uno con DUI y otro con NIT) y ver qué columnas y formatos devuelve.
   --------------------------------------------------------------------- */
-- EXEC DTE.dbo.dte_proveedor '<documento 1>', 'CINCOH';
-- EXEC DTE.dbo.dte_proveedor '<documento 2>', 'CINCOH';
-- EXEC DTE.dbo.dte_proveedor '<documento 3>', 'CINCOH';


/* ---------------------------------------------------------------------
   BLOQUE 6. Catálogo de distritos del ERP (el mismo que usa dte_Cliente)
   Confirma que existe y cómo se ven los códigos (depto / depto+muni / depto+dist).
   --------------------------------------------------------------------- */
SELECT COUNT(*) AS distritos_ESA
  FROM COAGRO2.erpadmin.DIVISION_GEOGRAFICA3
 WHERE PAIS = 'ESA';

SELECT TOP 10 PAIS, DIVISION_GEOGRAFICA1, DIVISION_GEOGRAFICA2, DIVISION_GEOGRAFICA3
  FROM COAGRO2.erpadmin.DIVISION_GEOGRAFICA3
 WHERE PAIS = 'ESA' AND DIVISION_GEOGRAFICA1 = '06'
 ORDER BY DIVISION_GEOGRAFICA2, DIVISION_GEOGRAFICA3;


/* ---------------------------------------------------------------------
   Qué decide cada resultado (para la Fase 1):
   - BLOQUE 2 trae DIVISION_GEOGRAFICA3 en una tabla de proveedores
       -> ampliar dte_proveedor igual que dte_Cliente (DEPTO_MH, MUNI_MH, DISTRITO_MH).
   - No la trae
       -> el distrito se elige en el formulario (catálogo del BLOQUE 6) o se
          carga en el ERP para cada proveedor.
   - BLOQUE 3 con largo_muni = 4
       -> hoy se guarda "0623"; hay que recortar a 2 dígitos ("23").
   - BLOQUE 4 con "VACIO" o "CORTO"
       -> convertir a NULL antes de enviar (Fase 2 / Fase 3).
   ===================================================================== */
