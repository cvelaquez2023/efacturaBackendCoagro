const { bonificacionNivelModel } = require("../../models");
const {
  crearCrudDescuento,
  validarNivelArticulo,
  validarNumero,
  existeArticulo,
} = require("./descuentoBase");

// erpadmin.BONIFICACION_NIVEL: por nivel de precio + moneda + articulo, regala UNIDADES_BONIF de ARTICULO_BONIF.
// ARTICULO_BONIF debe existir en erpadmin.ARTICULO (puede ser el mismo articulo).
// FACTOR_BONIF es opcional; si viene debe ser > 0.
const crud = crearCrudDescuento({
  model: bonificacionNivelModel,
  nombre: "bonificacion por nivel de precio",
  entidad: ["NIVEL_PRECIO", "MONEDA", "ARTICULO"],
  valores: ["ARTICULO_BONIF", "UNIDADES_BONIF", "FACTOR_BONIF"],
  validarEntidad: validarNivelArticulo,
  validarValores: async (v) => {
    const errores = [];
    if (!v.ARTICULO_BONIF) errores.push("El campo articuloBonif es obligatorio");
    else if (!(await existeArticulo(String(v.ARTICULO_BONIF).trim())))
      errores.push(`El articulo bonificado ${v.ARTICULO_BONIF} no existe en erpadmin.ARTICULO.`);
    [
      validarNumero(v.UNIDADES_BONIF, "unidadesBonif", { estricto: true }),
      validarNumero(v.FACTOR_BONIF, "factorBonif", { obligatorio: false, estricto: true }),
    ].forEach((e) => e && errores.push(e));
    return errores;
  },
});

module.exports = crud;
