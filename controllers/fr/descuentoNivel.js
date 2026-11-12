const { descuentoNivelModel } = require("../../models");
const { crearCrudDescuento, validarNivelArticulo, validarNumero } = require("./descuentoBase");

// erpadmin.DESCUENTO_NIVEL: porcentaje de descuento por nivel de precio + moneda + articulo.
const crud = crearCrudDescuento({
  model: descuentoNivelModel,
  nombre: "descuento por nivel de precio",
  entidad: ["NIVEL_PRECIO", "MONEDA", "ARTICULO"],
  valores: ["PORC_DESC"],
  validarEntidad: validarNivelArticulo,
  validarValores: async (v) => {
    const e = validarNumero(v.PORC_DESC, "porcDesc", { estricto: true, max: 100 });
    return e ? [e] : [];
  },
});

module.exports = crud;
