/* =====================================================================
   Flete por ruta (fr). Base COAGRO2, esquema erpadmin.

   Regla: si el pedido de la handheld suma menos de MINIMO_FLETE
   (total CON descuentos y CON IVA, sin contar la linea del flete),
   la app agrega una linea del articulo ARTICULO_FLETE por MONTO_FLETE.

   Se guarda en RUTA_CONSECUT_RT (1:1 con la ruta) porque esa tabla ya
   baja a la app en GET /fr/sync/consecutivos. Es tabla de Softland FR:
   las columnas nuevas tienen DEFAULT o aceptan NULL para no romper los
   INSERT que haga Softland o CargaAlMovil.

   Correr ANTES de publicar el backend: el modelo ya lee estas columnas
   y sin ellas GET /fr/rutaConsecutRt y /fr/sync/consecutivos fallan.
   ===================================================================== */

-- Defaults = valores de Softland: articulo 103, minimo $200 (con IVA y descuentos), flete $3.50 + IVA.
-- WITH VALUES: las rutas que ya existen tambien quedan con esos valores (si no, quedarian NULL).
ALTER TABLE COAGRO2.erpadmin.RUTA_CONSECUT_RT ADD
  USA_FLETE      char(1)       NOT NULL CONSTRAINT DF_RUTA_CONSECUT_RT_USA_FLETE      DEFAULT 'N',
  MINIMO_FLETE   decimal(18,2) NULL     CONSTRAINT DF_RUTA_CONSECUT_RT_MINIMO_FLETE   DEFAULT 200   WITH VALUES,
  MONTO_FLETE    decimal(18,2) NULL     CONSTRAINT DF_RUTA_CONSECUT_RT_MONTO_FLETE    DEFAULT 3.50  WITH VALUES,
  ARTICULO_FLETE varchar(20)   NULL     CONSTRAINT DF_RUTA_CONSECUT_RT_ARTICULO_FLETE DEFAULT '103' WITH VALUES;
GO

ALTER TABLE COAGRO2.erpadmin.RUTA_CONSECUT_RT
  ADD CONSTRAINT CK_RUTA_CONSECUT_RT_USA_FLETE CHECK (USA_FLETE IN ('S', 'N'));
GO

-- Las filas que ya existian quedan con USA_FLETE = 'N', MINIMO_FLETE = 200, MONTO_FLETE = 3.50 y
-- ARTICULO_FLETE = '103': solo falta encender el flete en las rutas que lo cobran (desde la web con
-- PUT /fr/rutaConsecutRt/:ruta { "usaFlete": "S" }, o aqui):
-- UPDATE COAGRO2.erpadmin.RUTA_CONSECUT_RT SET USA_FLETE = 'S' WHERE RUTA IN ('R01', 'R02');

-- Revisar antes de correr: que CargaAlMovil / CargaAlERP no hagan SELECT * o INSERT sin lista
-- de columnas sobre RUTA_CONSECUT_RT.
