/* =====================================================================
   Pendientes del modulo de rutas (fr): promociones, condiciones y
   razones de visita. Base COAGRO2, esquema erpadmin.
   ===================================================================== */


/* ---------------------------------------------------------------------
   1) CORRER YA: ampliar la descripcion de Razones de Visita a 60.
      El backend (models/fr/EfectividadVisita.js) ya acepta 60; hasta
      correr esto, una descripcion de mas de 20 da error de truncado.
      Las 2 vistas copian esa columna y hay que refrescarlas.
   --------------------------------------------------------------------- */
ALTER TABLE COAGRO2.erpadmin.EFECT_VISITA_RT ALTER COLUMN DESCRIPCION varchar(60) NOT NULL;
EXEC COAGRO2.sys.sp_refreshview 'erpadmin.ReporteVisitas';
EXEC COAGRO2.sys.sp_refreshview 'erpadmin.V_UBICACIONES_VISITA';
-- Revisar que la app movil acepte textos de hasta 60 en el combo de razones.


/* ---------------------------------------------------------------------
   2) PENDIENTE: catalogo de TIPOS DE CLIENTE.
      Hoy FR_PROMOCION_DESTINO con TIPO = 'K' guarda el tipo como texto
      libre y NO se valida. /fr/tipoCliente NO existe todavia y la web
      usa una lista fija.
      Cuando se cree la tabla:
        - crear modelo, CRUD y GET /fr/tipoCliente;
        - validar FR_PROMOCION_DESTINO (TIPO='K') contra ella en
          controllers/fr/promocion.js (validarPromocion);
        - definir de donde sale el tipo de cada cliente, para que
          utils/precioFr.js lo tome solo (hoy llega por ?tipoCliente=).
   --------------------------------------------------------------------- */
-- Ejemplo de estructura (AJUSTAR antes de correr):
-- CREATE TABLE COAGRO2.erpadmin.FR_TIPO_CLIENTE (
--     TIPO_CLIENTE VARCHAR(10)  NOT NULL PRIMARY KEY,
--     DESCRIPCION  VARCHAR(60)  NOT NULL,
--     ACTIVO       CHAR(1)      NOT NULL DEFAULT 'S' CHECK (ACTIVO IN ('S','N'))
-- );


/* ---------------------------------------------------------------------
   3) PENDIENTE: tabla de CLIENTES para condiciones y promociones.
      Hoy FR_CONDICION_CLIENTE.CLIENTE y FR_PROMOCION_DESTINO (TIPO='C')
      guardan el codigo como texto libre y NO se validan.
      /fr/precioVigente toma el nivel de precio de erpadmin.cliente.COD_CLT
      (igual que /fr/sync/precios de la app) o de ?nivelPrecio=.
      Cuando se cree la tabla:
        - validar el cliente en controllers/fr/condicionCliente.js
          (validarCondicion) y en controllers/fr/promocion.js (destino 'C');
        - confirmar que el codigo guardado sea el mismo que usa la app
          (COD_CLT) para que web y app den el mismo precio.
   --------------------------------------------------------------------- */
-- Ejemplo de estructura (AJUSTAR antes de correr):
-- CREATE TABLE COAGRO2.erpadmin.FR_CLIENTE (
--     CLIENTE       VARCHAR(20) NOT NULL PRIMARY KEY,
--     NOMBRE        VARCHAR(150) NOT NULL,
--     TIPO_CLIENTE  VARCHAR(10) NULL,  -- FK a FR_TIPO_CLIENTE
--     CATEGORIA     CHAR(1)     NULL CHECK (CATEGORIA IN ('A','B','C','D')),
--     ACTIVO        CHAR(1)     NOT NULL DEFAULT 'S' CHECK (ACTIVO IN ('S','N'))
-- );
