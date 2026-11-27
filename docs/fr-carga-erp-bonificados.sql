-- CargaAlERP: carga las lineas regaladas (ART_BON = '1') de los pedidos de la app.
-- Antes: el pedido con regalos se rechazaba ('no soportado todavia') y se quedaba con DOC_PRO = 'N'.
-- Ahora la linea regalada entra a CINCOH.PEDIDO_LINEA como las bonificaciones de Softland:
--   CANTIDAD_PEDIDA = 0, CANTIDAD_A_FACTURA = 0, CANTIDAD_BONIFICAD = CNT_MAX + CNT_MIN / FACTOR_EMPAQUE,
--   PRECIO_UNITARIO = precio de lista (erpadmin.ARTICULO_PRECIO del nivel del pedido; la app la manda en 0),
--   MONTO_DESCUENTO y PORC_DESCUENTO en 0, mismos impuestos. PEDIDO_LINEA_BONIF queda null (la app no dice
--   que linea vendida genero el regalo; Softland tambien tiene regalos sin esa liga).
-- Se rechaza el pedido si trae ART_BON distinto de 0/1 o si solo trae lineas regaladas.
-- Lo demas del procedimiento queda IGUAL (copiado de la definicion actual, nov 2026).
-- Totales del encabezado sin cambio: TOTAL_UNIDADES ya suma todas las lineas (Softland tambien cuenta
-- los regalos) y los montos vienen de la app, donde la regalada va en 0.
USE COAGRO2;
GO
ALTER PROCEDURE [erpadmin].[CargaAlERP]
    @COD_CIA VARCHAR(10) = 'CINCOH'
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

	--actualizamos cliente
	UPDATE c
SET  c.TELEFONO1       = ISNULL(NULLIF(LTRIM(RTRIM(cc.NUM_TEL)), ''),             c.TELEFONO1),
     c.RUBRO8_CLIENTE  = ISNULL(NULLIF(LTRIM(RTRIM(cc.codActividad)), ''),        c.RUBRO8_CLIENTE),
     c.RUBRO9_CLIENTE  = ISNULL(NULLIF(LEFT(LTRIM(RTRIM(cc.desActividad)), 200), ''), c.RUBRO9_CLIENTE),
     c.RUBRO11_CLIENTE = ISNULL(NULLIF(LTRIM(RTRIM(cc.nomEncargadoCompras)), ''), c.RUBRO11_CLIENTE),
     c.RUBRO12_CLIENTE = ISNULL(NULLIF(LTRIM(RTRIM(cc.telEncargadoCompras)), ''), c.RUBRO12_CLIENTE),
     c.RUBRO13_CLIENTE = ISNULL(NULLIF(LTRIM(RTRIM(cc.nomEncargadoPagos)), ''),   c.RUBRO13_CLIENTE),
     c.RUBRO14_CLIENTE = ISNULL(NULLIF(LTRIM(RTRIM(cc.telEncargadoPagos)), ''),   c.RUBRO14_CLIENTE),
     c.UpdatedBy       = SUSER_SNAME(),
     c.RecordDate      = GETDATE()
FROM CINCOH.CLIENTE c
JOIN erpadmin.CLIENTE_CIA cc
      ON cc.COD_CLT = c.CLIENTE
     AND cc.COD_CIA = 'CINCOH'
WHERE ISNULL(cc.doc_pro, 'N') = 'N';



    DECLARE @NUM_PED   VARCHAR(50),
            @COD_CLT   VARCHAR(20),
            @MSG       VARCHAR(4000),
            @OK        INT = 0,
            @ERR       INT = 0,
            @ID_INICIO INT;

    SELECT @ID_INICIO = ISNULL(MAX(ID), 0) FROM ERPADMIN.LOG_CARGA_ERP;

    DECLARE C_PED CURSOR LOCAL FAST_FORWARD FOR
        SELECT NUM_PED, COD_CLT
        FROM ERPADMIN.alFAC_ENC_PED
        WHERE COD_CIA = @COD_CIA
          AND ISNULL(DOC_PRO, 'N') = 'N' AND TIP_DOC = 'F'
        ORDER BY FEC_PED, NUM_PED;

    OPEN C_PED;
    FETCH NEXT FROM C_PED INTO @NUM_PED, @COD_CLT;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @MSG = NULL;

        /* ---------- Validaciones ---------- */
        IF EXISTS (SELECT 1 FROM CINCOH.PEDIDO WHERE PEDIDO = @NUM_PED)
            SET @MSG = 'El pedido ya existe en CINCOH.PEDIDO';
        ELSE IF NOT EXISTS (SELECT 1 FROM ERPADMIN.alFAC_DET_PED
                            WHERE COD_CIA = @COD_CIA AND NUM_PED = @NUM_PED)
            SET @MSG = 'El pedido no tiene líneas de detalle';
        ELSE IF NOT EXISTS (SELECT 1 FROM CINCOH.CLIENTE
                            WHERE CLIENTE = @COD_CLT AND ACTIVO = 'S')
            SET @MSG = 'El cliente ' + @COD_CLT + ' no existe o está inactivo';
        ELSE IF EXISTS (SELECT 1 FROM ERPADMIN.alFAC_DET_PED d
                        WHERE d.COD_CIA = @COD_CIA AND d.NUM_PED = @NUM_PED
                          AND NOT EXISTS (SELECT 1 FROM CINCOH.ARTICULO a WHERE a.ARTICULO = d.COD_ART))
            SET @MSG = 'Artículos inexistentes: ' +
                       (SELECT d.COD_ART + ' '
                        FROM ERPADMIN.alFAC_DET_PED d
                        WHERE d.COD_CIA = @COD_CIA AND d.NUM_PED = @NUM_PED
                          AND NOT EXISTS (SELECT 1 FROM CINCOH.ARTICULO a WHERE a.ARTICULO = d.COD_ART)
                        FOR XML PATH(''));
        -- Bonificadas: ART_BON '1' (regalada) se carga como bonificacion; vacio/null = vendida.
        ELSE IF EXISTS (SELECT 1 FROM ERPADMIN.alFAC_DET_PED
                        WHERE COD_CIA = @COD_CIA AND NUM_PED = @NUM_PED
                          AND ISNULL(NULLIF(ART_BON, ''), '0') NOT IN ('0', '1'))
            SET @MSG = 'Trae líneas con ART_BON distinto de 0 (vendida) o 1 (regalada)';
        ELSE IF NOT EXISTS (SELECT 1 FROM ERPADMIN.alFAC_DET_PED
                            WHERE COD_CIA = @COD_CIA AND NUM_PED = @NUM_PED
                              AND ISNULL(NULLIF(ART_BON, ''), '0') = '0')
            SET @MSG = 'El pedido solo trae líneas regaladas';
        ELSE IF EXISTS (SELECT 1
                        FROM ERPADMIN.alFAC_DET_PED d
                        CROSS APPLY erpadmin.fn_CuentaVentaArticulo(d.COD_ART) cc
                        WHERE d.COD_CIA = @COD_CIA AND d.NUM_PED = @NUM_PED
                          AND (cc.CUENTA_CONTABLE IS NULL OR cc.CENTRO_COSTO IS NULL))
            SET @MSG = 'Artículos sin cuenta/centro de costo de ventas: ' +
                       (SELECT d.COD_ART + ' '
                        FROM ERPADMIN.alFAC_DET_PED d
                        CROSS APPLY erpadmin.fn_CuentaVentaArticulo(d.COD_ART) cc
                        WHERE d.COD_CIA = @COD_CIA AND d.NUM_PED = @NUM_PED
                          AND (cc.CUENTA_CONTABLE IS NULL OR cc.CENTRO_COSTO IS NULL)
                        FOR XML PATH(''));

        IF @MSG IS NOT NULL
        BEGIN
            INSERT INTO ERPADMIN.LOG_CARGA_ERP (COD_CIA, NUM_PED, RESULTADO, MENSAJE)
            VALUES (@COD_CIA, @NUM_PED, 'ERROR', @MSG);
            SET @ERR = @ERR + 1;
        END
        ELSE
        BEGIN
            BEGIN TRY
                BEGIN TRANSACTION;

                /* ---------- Encabezado ---------- */
                INSERT INTO CINCOH.PEDIDO (
                    PEDIDO, ESTADO, FECHA_PEDIDO, FECHA_PROMETIDA, FECHA_PROX_EMBARQU, DIREC_EMBARQUE,
                    TOTAL_MERCADERIA, MONTO_ANTICIPO, MONTO_FLETE, MONTO_SEGURO, MONTO_DOCUMENTACIO,
                    TIPO_DESCUENTO1, TIPO_DESCUENTO2, MONTO_DESCUENTO1, MONTO_DESCUENTO2,
                    PORC_DESCUENTO1, PORC_DESCUENTO2, TOTAL_IMPUESTO1, TOTAL_IMPUESTO2, TOTAL_A_FACTURAR,
                    PORC_COMI_VENDEDOR, PORC_COMI_COBRADOR, TOTAL_CANCELADO, TOTAL_UNIDADES,
                    IMPRESO, FECHA_HORA, DESCUENTO_VOLUMEN, TIPO_PEDIDO, MONEDA_PEDIDO, VERSION_NP,
                    AUTORIZADO, DOC_A_GENERAR, CLASE_PEDIDO, MONEDA, NIVEL_PRECIO,
                    COBRADOR, RUTA, USUARIO, CONDICION_PAGO, BODEGA, ZONA, VENDEDOR,
                    CLIENTE, CLIENTE_DIRECCION, CLIENTE_CORPORAC, CLIENTE_ORIGEN, PAIS,
                    BACKORDER, DESCUENTO_CASCADA, DIRECCION_FACTURA, FIJAR_TIPO_CAMBIO, TIPO_DOCUMENTO,
                    OBSERVACIONES, SUBTIPO_DOC_CXC, TIPO_DOC_CXC, ORIGEN_PEDIDO, BASE_IMPUESTO1,
                    ACTIVIDAD_COMERCIAL, EMBARCAR_A, DESC_DIREC_EMBARQUE, RowPointer)
                SELECT
                    e.NUM_PED, 'N', e.FEC_PED, e.FEC_DES, e.FEC_DES, e.DIR_ENT,
                    e.MON_SIV, 0, 0, 0, 0,
                    'P', 'P', ISNULL(e.MONT_DESC1, 0), ISNULL(e.MONT_DESC2, 0),
                    ISNULL(e.DESC1, 0), ISNULL(e.DESC2, 0), e.MON_IMP_VT, 0, e.MON_CIV,
                    0, 0, 0,
                    (SELECT SUM(d.CNT_MAX + d.CNT_MIN / ISNULL(NULLIF(a.FACTOR_EMPAQUE, 0), 1))
                     FROM ERPADMIN.alFAC_DET_PED d
                     JOIN CINCOH.ARTICULO a ON a.ARTICULO = d.COD_ART
                     WHERE d.COD_CIA = e.COD_CIA AND d.NUM_PED = e.NUM_PED),
                    'N', e.HOR_FIN, 0, 'N', 'L', 8,
                    'N', e.TIP_DOC, 'N', ISNULL(e.MONEDA, c.MONEDA_NIVEL), ISNULL(e.NIVEL_PRECIO, c.NIVEL_PRECIO),
                    c.COBRADOR, c.RUTA, 'SA', e.COD_CND, e.COD_BOD, c.ZONA, c.VENDEDOR,
                    e.COD_CLT, e.COD_CLT, e.COD_CLT, e.COD_CLT, c.PAIS,
                    'N', e.DESCUENTO_CASCADA, ISNULL(CAST(c.DIRECCION AS VARCHAR(4000)), ''), 'N', 'P',
                    e.OBS_PED,
                    CASE WHEN e.SUBTIPO_DOC <> '' AND e.SUBTIPO_DOC NOT LIKE '%[^0-9]%'
                         THEN CAST(e.SUBTIPO_DOC AS SMALLINT) END,
                    'FAC', 'F', e.MON_SIV - e.MON_DSC,
                    NULL,   -- ACTIVIDAD_COMERCIAL: el catálogo CINCOH.ACTIVIDAD_COMERCIAL está vacío
                    LEFT(c.ALIAS, 160),                                        -- EMBARCAR_A (igual que Softland)
                    NULLIF(CAST(de.DESCRIPCION AS VARCHAR(250)), ''),          -- DESC_DIREC_EMBARQUE
                    NEWID()
                FROM ERPADMIN.alFAC_ENC_PED e
                JOIN CINCOH.CLIENTE c ON c.CLIENTE = e.COD_CLT
                LEFT JOIN CINCOH.DIRECC_EMBARQUE de ON de.CLIENTE = e.COD_CLT AND de.DIRECCION = e.DIR_ENT
                WHERE e.COD_CIA = @COD_CIA AND e.NUM_PED = @NUM_PED AND e.TIP_DOC = 'F';

                /* ---------- Líneas ---------- */
                INSERT INTO CINCOH.PEDIDO_LINEA (
                    PEDIDO, PEDIDO_LINEA, BODEGA, ARTICULO, ESTADO, FECHA_ENTREGA, LINEA_USUARIO,
                    PRECIO_UNITARIO, CANTIDAD_PEDIDA, CANTIDAD_A_FACTURA, CANTIDAD_FACTURADA,
                    CANTIDAD_RESERVADA, CANTIDAD_BONIFICAD, CANTIDAD_CANCELADA,
                    TIPO_DESCUENTO, MONTO_DESCUENTO, PORC_DESCUENTO, FECHA_PROMETIDA,
                    TIPO_IMPUESTO1, TIPO_TARIFA1, PORC_IMPUESTO1, ES_OTRO_CARGO, ES_CANASTA_BASICA,
                    LOTE, LOCALIZACION,
                    CENTRO_COSTO, CUENTA_CONTABLE,
                    RowPointer)
                SELECT
                    d.NUM_PED, d.NUM_LN, e.COD_BOD, d.COD_ART, 'N', e.FEC_DES, d.NUM_LN - 1,
                    -- Regalada (como la guarda Softland): precio de lista, cantidad en CANTIDAD_BONIFICAD,
                    -- pedida y a facturar en 0, sin descuento. Vendida: igual que antes.
                    CASE WHEN b.BON = 1 THEN ISNULL(lp.PRECIO, 0) ELSE d.MON_PRC_MX END,
                    CASE WHEN b.BON = 1 THEN 0 ELSE q.CANTIDAD END,
                    CASE WHEN b.BON = 1 THEN 0 ELSE q.CANTIDAD END, 0,
                    0, CASE WHEN b.BON = 1 THEN q.CANTIDAD ELSE 0 END, 0,
                    'P', CASE WHEN b.BON = 1 THEN 0 ELSE d.MON_DSC END,
                    CASE WHEN b.BON = 1 THEN 0 ELSE d.POR_DSC_AP END, e.FEC_DES,
                    d.TIPO_IMPUESTO1, d.TIPO_TARIFA1, d.PORC_IMPUESTO1, d.ES_OTRO_CARGO, d.ES_CANASTA_BASICA,
                    lt.LOTE, lt.LOCALIZACION,
                    cc.CENTRO_COSTO, cc.CUENTA_CONTABLE,
                    NEWID()
                FROM ERPADMIN.alFAC_DET_PED d
                JOIN ERPADMIN.alFAC_ENC_PED e ON e.COD_CIA = d.COD_CIA AND e.NUM_PED = d.NUM_PED
                JOIN CINCOH.ARTICULO a ON a.ARTICULO = d.COD_ART
                JOIN CINCOH.CLIENTE c ON c.CLIENTE = e.COD_CLT
                CROSS APPLY (SELECT d.CNT_MAX + d.CNT_MIN / ISNULL(NULLIF(a.FACTOR_EMPAQUE, 0), 1) AS CANTIDAD) q
                CROSS APPLY (SELECT CASE WHEN d.ART_BON = '1' THEN 1 ELSE 0 END AS BON) b
                -- Precio de lista de la regalada: mismo origen que la app (ARTICULO_PRECIO del nivel del pedido)
                OUTER APPLY (SELECT TOP 1 ap.PRECIO
                             FROM ERPADMIN.ARTICULO_PRECIO ap
                             WHERE b.BON = 1
                               AND ap.ARTICULO = d.COD_ART
                               AND ap.NIVEL_PRECIO = ISNULL(e.NIVEL_PRECIO, c.NIVEL_PRECIO)
                             ORDER BY ap.VERSION DESC, ap.VERSION_ARTICULO DESC) lp
                OUTER APPLY erpadmin.fn_CuentaVentaArticulo(d.COD_ART) cc
                -- Lote con existencia que vence primero (sin vencer), solo si el artículo usa lotes
                OUTER APPLY (SELECT TOP 1 el.LOTE, el.LOCALIZACION
                             FROM CINCOH.EXISTENCIA_LOTE el
                             JOIN CINCOH.LOTE lo ON lo.ARTICULO = el.ARTICULO AND lo.LOTE = el.LOTE
                             WHERE a.USA_LOTES = 'S'
                               AND el.ARTICULO = d.COD_ART
                               AND el.BODEGA = e.COD_BOD
                               AND el.CANT_DISPONIBLE > 0
                               AND lo.FECHA_VENCIMIENTO >= CAST(GETDATE() AS DATE)
                             ORDER BY lo.FECHA_VENCIMIENTO, el.LOTE) lt
                WHERE d.COD_CIA = @COD_CIA AND d.NUM_PED = @NUM_PED AND e.TIP_DOC = 'F';

                /* ---------- Marcar como procesado ---------- */
                UPDATE ERPADMIN.alFAC_ENC_PED
                SET DOC_PRO = 'S'
                WHERE COD_CIA = @COD_CIA AND NUM_PED = @NUM_PED AND ISNULL(DOC_PRO, 'N') = 'N';

                IF @@ROWCOUNT <> 1
                    RAISERROR('No se pudo marcar DOC_PRO = ''S'' (otro proceso lo cambió)', 16, 1);

                COMMIT TRANSACTION;

                INSERT INTO ERPADMIN.LOG_CARGA_ERP (COD_CIA, NUM_PED, RESULTADO, MENSAJE)
                VALUES (@COD_CIA, @NUM_PED, 'OK', 'Pedido cargado en CINCOH.PEDIDO');
                SET @OK = @OK + 1;
            END TRY
            BEGIN CATCH
                IF XACT_STATE() <> 0
                    ROLLBACK TRANSACTION;

                INSERT INTO ERPADMIN.LOG_CARGA_ERP (COD_CIA, NUM_PED, RESULTADO, MENSAJE)
                VALUES (@COD_CIA, @NUM_PED, 'ERROR', LEFT(ERROR_MESSAGE(), 4000));
                SET @ERR = @ERR + 1;
            END CATCH
        END

        FETCH NEXT FROM C_PED INTO @NUM_PED, @COD_CLT;
    END

    CLOSE C_PED;
    DEALLOCATE C_PED;

    /* ---------- Resumen de la ejecución ---------- */
    SELECT @OK AS PEDIDOS_CARGADOS, @ERR AS PEDIDOS_CON_ERROR;

    SELECT NUM_PED, RESULTADO, MENSAJE, FECHA
    FROM ERPADMIN.LOG_CARGA_ERP
    WHERE ID > @ID_INICIO
    ORDER BY ID;
END
GO
