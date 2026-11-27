/* =====================================================================
   Bonificaciones con VARIOS productos regalados (fr), nov 2026.
   Base COAGRO2, esquema erpadmin. Correr ANTES de publicar el backend.

   Regla (decision del usuario):
     - Se configuran en las promociones web (FR_PROMOCION TIPO = 'B').
     - "Me llevo X y me dan Y y Z": cada promocion B tiene N articulos
       regalados en FR_PROMOCION_BONIFICADO (articulo + cantidad).
     - Proporcional: por cada CANTIDAD_MIN unidades de UN producto de la
       promocion (FR_PROMOCION_PRODUCTO, cada producto por separado) se
       regala CANTIDAD de cada articulo de la lista.
       Ej: CANTIDAD_MIN 10, regalos Y x1 y Z x2; compra 25 -> 2 de Y y 4 de Z.
     - ARTICULO_BONIFICADO / CANTIDAD_BONIFICADA del encabezado quedan en
       desuso (siempre NULL desde ahora).
   ===================================================================== */
USE COAGRO2;
GO

BEGIN TRANSACTION;

-- 1) Articulos regalados de cada promocion de bonificacion.
CREATE TABLE erpadmin.FR_PROMOCION_BONIFICADO (
    ID            int IDENTITY(1,1) NOT NULL CONSTRAINT PK_FR_PROMOCION_BONIFICADO PRIMARY KEY,
    PROMOCION_ID  int          NOT NULL,
    ARTICULO      varchar(20)  NOT NULL,
    CANTIDAD      int          NOT NULL CONSTRAINT CK_FR_PROMOCION_BONIFICADO_CANTIDAD CHECK (CANTIDAD > 0),
    CONSTRAINT FK_PROMOCION_BONIFICADO_PROMOCION FOREIGN KEY (PROMOCION_ID)
        REFERENCES erpadmin.FR_PROMOCION (ID) ON DELETE CASCADE,
    CONSTRAINT UQ_FR_PROMOCION_BONIFICADO UNIQUE (PROMOCION_ID, ARTICULO)
);

-- 2) Pasar a la tabla nueva las bonificaciones que hubiera en el encabezado
--    (al crear este script no habia ninguna promocion TIPO 'B').
INSERT INTO erpadmin.FR_PROMOCION_BONIFICADO (PROMOCION_ID, ARTICULO, CANTIDAD)
SELECT ID, LTRIM(RTRIM(ARTICULO_BONIFICADO)), CANTIDAD_BONIFICADA
  FROM erpadmin.FR_PROMOCION
 WHERE TIPO = 'B' AND ARTICULO_BONIFICADO IS NOT NULL AND CANTIDAD_BONIFICADA IS NOT NULL;

UPDATE erpadmin.FR_PROMOCION
   SET ARTICULO_BONIFICADO = NULL, CANTIDAD_BONIFICADA = NULL
 WHERE TIPO = 'B';

-- 3) El CHECK viejo OBLIGABA ARTICULO_BONIFICADO/CANTIDAD_BONIFICADA en TIPO 'B'.
--    Ahora los regalos van en la tabla hija: el encabezado ya no los exige.
ALTER TABLE erpadmin.FR_PROMOCION DROP CONSTRAINT CHK_FR_PROMOCION_BONIFICACION;
ALTER TABLE erpadmin.FR_PROMOCION ADD CONSTRAINT CHK_FR_PROMOCION_BONIFICACION
    CHECK (TIPO = 'B' OR (ARTICULO_BONIFICADO IS NULL AND CANTIDAD_BONIFICADA IS NULL));

COMMIT TRANSACTION;
GO

-- Verificacion
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
  FROM COAGRO2.INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA = 'erpadmin' AND TABLE_NAME = 'FR_PROMOCION_BONIFICADO';
SELECT name, definition FROM COAGRO2.sys.check_constraints
 WHERE name = 'CHK_FR_PROMOCION_BONIFICACION';
