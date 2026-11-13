const { descuentoCliartModel } = require("../../models");
const { crearCrudDescuento, validarClienteArticulo, validarNumero } = require("./descuentoBase");

// erpadmin.DESCUENTO_CLIART: descuento por cliente + articulo.
// TIPO: CHECK real en BD (DESCUENTO_CLIARTTIPO_CK) -> 'P' = porcentaje, 'F' = monto fijo.
// Se acepta en minuscula y se guarda en mayuscula. Si es 'P', MONTO no puede pasar de 100.
const TIPOS = ["P", "F"];

const crud = crearCrudDescuento({
  model: descuentoCliartModel,
  nombre: "descuento por cliente",
  entidad: ["CLIENTE", "ARTICULO"],
  valores: ["TIPO", "MONTO"],
  validarEntidad: validarClienteArticulo,
  validarValores: async (v) => {
    const errores = [];
    const tipo = String(v.TIPO || "").trim().toUpperCase();
    if (!TIPOS.includes(tipo)) errores.push("El campo tipo debe ser P (porcentaje) o F (monto fijo)");
    else v.TIPO = tipo;
    const e = validarNumero(v.MONTO, "monto", { estricto: true, max: tipo === "P" ? 100 : undefined });
    if (e) errores.push(e);
    return errores;
  },
});

module.exports = crud;
