const {
  bodegaAsocRtModel,
  bodegaRtModel,
  consecutivoCiErpModel,
} = require("../../models");
const { getPaginacion, respuestaPaginada } = require("../../utils/paginacion");

const FLAGS_VALIDOS = ["S", "N"];

const parseErrores = (error, fallback) => {
  if (error.name === "SequelizeValidationError") {
    return error.errors.map((e) => e.message);
  }
  if (error.parent && error.parent.number === 8152) {
    return [
      "Un valor supera el tamano permitido. Largos: BODEGA 4, CODIGO 4, CODIGO_BODEGA_RETABLECER 4, PAQUETE_INVENTARIO 4, CONSECUTIVO_CI 10, LOCALIZACION 8.",
    ];
  }
  if (error.name === "SequelizeUniqueConstraintError") {
    return ["Ya existe una asociacion con esa bodega y ese codigo."];
  }
  return [fallback];
};

const validarFlags = ({ codigoBodegaRetablecer, paqueteInventario }) => {
  if (codigoBodegaRetablecer && !FLAGS_VALIDOS.includes(codigoBodegaRetablecer)) {
    return "El campo codigoBodegaRetablecer debe ser S o N";
  }
  if (paqueteInventario && !FLAGS_VALIDOS.includes(paqueteInventario)) {
    return "El campo paqueteInventario debe ser S o N";
  }
  return null;
};

// CODIGO_BODEGA_RETABLECER: "S" = el codigo de ruteo debe ser igual al de la
// bodega del ERP (no se usa alias). "N" = el codigo es propio/distinto
// (alias). Si mandan S con un codigo distinto a la bodega, es inconsistente.
const validarCoherenciaCodigo = ({ bodega, codigo, codigoBodegaRetablecer }) => {
  if (codigoBodegaRetablecer === "S" && codigo !== bodega) {
    return `Si codigoBodegaRetablecer es S, el codigo debe ser igual al de la bodega del ERP (${bodega}). Los codigos no coinciden.`;
  }
  return null;
};

// GET /fr/bodegaAsocRt?page=1&limit=20
const getBodegasAsocRt = async (req, res) => {
  try {
    const { page, limit, offset } = getPaginacion(req.query);
    const data = await bodegaAsocRtModel.findAndCountAll({
      limit,
      offset,
      order: [["BODEGA", "ASC"]],
      raw: true,
    });
    res.send(respuestaPaginada(data, { page, limit }));
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al consultar las asociaciones de bodega"),
    });
  }
};

// GET /fr/bodegaAsocRt/:bodega
const getBodegaAsocRt = async (req, res) => {
  const { bodega } = req.params;
  try {
    const data = await bodegaAsocRtModel.findOne({
      where: { BODEGA: bodega },
      raw: true,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al consultar la asociacion de bodega"),
    });
  }
};

// POST /fr/bodegaAsocRt
// { bodega, codigo, codigoBodegaRetablecer, paqueteInventario, consecutivoCi, localizacion }
// Asocia una bodega que YA existe en BODEGA_RT con un codigo propio del
// sistema de ruteo. Relacion 1:1: ni la bodega ni el codigo pueden repetirse.
const postBodegaAsocRt = async (req, res) => {
  try {
    const {
      bodega,
      codigo,
      codigoBodegaRetablecer,
      paqueteInventario,
      consecutivoCi,
      localizacion,
    } = req.body;

    if (!bodega || !codigo) {
      return res.send({
        result: {},
        success: false,
        errors: ["Los campos bodega y codigo son obligatorios"],
      });
    }

    const errorFlags = validarFlags({ codigoBodegaRetablecer, paqueteInventario });
    if (errorFlags) {
      return res.send({ result: {}, success: false, errors: [errorFlags] });
    }

    // Si no la mandan, por defecto es N (codigo propio/alias).
    const codigoBodegaRetablecerFinal = codigoBodegaRetablecer || "N";
    const errorCoherencia = validarCoherenciaCodigo({
      bodega,
      codigo,
      codigoBodegaRetablecer: codigoBodegaRetablecerFinal,
    });
    if (errorCoherencia) {
      return res.send({ result: {}, success: false, errors: [errorCoherencia] });
    }

    const bodegaRt = await bodegaRtModel.findOne({
      where: { BODEGA: bodega },
      raw: true,
    });
    if (!bodegaRt) {
      return res.send({
        result: {},
        success: false,
        errors: [
          `La bodega ${bodega} no existe en el modulo de rutas. Dala de alta primero con POST /fr/bodegaRt.`,
        ],
      });
    }

    if (consecutivoCi) {
      const consecutivo = await consecutivoCiErpModel.findOne({
        where: { CONSECUTIVO: consecutivoCi },
        raw: true,
      });
      if (!consecutivo) {
        return res.send({
          result: {},
          success: false,
          errors: [`El consecutivo ${consecutivoCi} no existe en el ERP.`],
        });
      }
    }

    const bodegaYaAsociada = await bodegaAsocRtModel.findOne({
      where: { BODEGA: bodega },
      raw: true,
    });
    if (bodegaYaAsociada) {
      return res.send({
        result: {},
        success: false,
        errors: [
          `La bodega ${bodega} ya tiene un codigo asociado (${bodegaYaAsociada.CODIGO}).`,
        ],
      });
    }

    const codigoYaUsado = await bodegaAsocRtModel.findOne({
      where: { CODIGO: codigo },
      raw: true,
    });
    if (codigoYaUsado) {
      return res.send({
        result: {},
        success: false,
        errors: [
          `El codigo ${codigo} ya esta asociado a otra bodega (${codigoYaUsado.BODEGA}).`,
        ],
      });
    }

    const data = await bodegaAsocRtModel.create({
      BODEGA: bodega,
      CODIGO: codigo,
      COMPANIA: null, // el sistema no maneja companias
      CODIGO_BODEGA_RETABLECER: codigoBodegaRetablecerFinal,
      PAQUETE_INVENTARIO: paqueteInventario || null,
      CONSECUTIVO_CI: consecutivoCi || null,
      LOCALIZACION: localizacion || null,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al crear la asociacion de bodega"),
    });
  }
};

// PUT /fr/bodegaAsocRt/:bodega
// { codigo, codigoBodegaRetablecer, paqueteInventario, consecutivoCi, localizacion }
const putBodegaAsocRt = async (req, res) => {
  const { bodega } = req.params;
  try {
    const {
      codigo,
      codigoBodegaRetablecer,
      paqueteInventario,
      consecutivoCi,
      localizacion,
    } = req.body;

    const errorFlags = validarFlags({ codigoBodegaRetablecer, paqueteInventario });
    if (errorFlags) {
      return res.send({ result: {}, success: false, errors: [errorFlags] });
    }

    const actual = await bodegaAsocRtModel.findOne({
      where: { BODEGA: bodega },
      raw: true,
    });
    if (!actual) {
      return res.send({
        result: {},
        success: false,
        errors: [`La bodega ${bodega} no tiene una asociacion en el modulo de rutas.`],
      });
    }

    // Se valida la coherencia con el resultado final (lo que mandan o, si no
    // mandan el campo, lo que ya tenia el registro).
    const codigoFinal = codigo !== undefined ? codigo : actual.CODIGO;
    const codigoBodegaRetablecerFinal =
      codigoBodegaRetablecer !== undefined
        ? codigoBodegaRetablecer
        : actual.CODIGO_BODEGA_RETABLECER;
    const errorCoherencia = validarCoherenciaCodigo({
      bodega,
      codigo: codigoFinal,
      codigoBodegaRetablecer: codigoBodegaRetablecerFinal,
    });
    if (errorCoherencia) {
      return res.send({ result: {}, success: false, errors: [errorCoherencia] });
    }

    if (codigo) {
      const codigoYaUsado = await bodegaAsocRtModel.findOne({
        where: { CODIGO: codigo },
        raw: true,
      });
      if (codigoYaUsado && codigoYaUsado.BODEGA !== bodega) {
        return res.send({
          result: {},
          success: false,
          errors: [
            `El codigo ${codigo} ya esta asociado a otra bodega (${codigoYaUsado.BODEGA}).`,
          ],
        });
      }
    }

    if (consecutivoCi) {
      const consecutivo = await consecutivoCiErpModel.findOne({
        where: { CONSECUTIVO: consecutivoCi },
        raw: true,
      });
      if (!consecutivo) {
        return res.send({
          result: {},
          success: false,
          errors: [`El consecutivo ${consecutivoCi} no existe en el ERP.`],
        });
      }
    }

    const cambios = {};
    if (codigo !== undefined) cambios.CODIGO = codigo;
    if (codigoBodegaRetablecer !== undefined)
      cambios.CODIGO_BODEGA_RETABLECER = codigoBodegaRetablecer;
    if (paqueteInventario !== undefined) cambios.PAQUETE_INVENTARIO = paqueteInventario;
    if (consecutivoCi !== undefined) cambios.CONSECUTIVO_CI = consecutivoCi;
    if (localizacion !== undefined) cambios.LOCALIZACION = localizacion;

    const data = await bodegaAsocRtModel.update(cambios, {
      where: { BODEGA: bodega },
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al actualizar la asociacion de bodega"),
    });
  }
};

// PUT /fr/bodegaAsocRt/:bodega/restablecer
// Restablece el codigo de ruteo para que sea igual al de la bodega del ERP:
// pone CODIGO = BODEGA y CODIGO_BODEGA_RETABLECER = "S" en un solo paso.
const putRestablecerBodegaAsocRt = async (req, res) => {
  const { bodega } = req.params;
  try {
    const actual = await bodegaAsocRtModel.findOne({
      where: { BODEGA: bodega },
      raw: true,
    });
    if (!actual) {
      return res.send({
        result: {},
        success: false,
        errors: [`La bodega ${bodega} no tiene una asociacion en el modulo de rutas.`],
      });
    }

    if (actual.CODIGO !== bodega) {
      const codigoYaUsado = await bodegaAsocRtModel.findOne({
        where: { CODIGO: bodega },
        raw: true,
      });
      if (codigoYaUsado && codigoYaUsado.BODEGA !== bodega) {
        return res.send({
          result: {},
          success: false,
          errors: [
            `No se puede restablecer: el codigo ${bodega} ya esta asociado a otra bodega (${codigoYaUsado.BODEGA}).`,
          ],
        });
      }
    }

    const data = await bodegaAsocRtModel.update(
      { CODIGO: bodega, CODIGO_BODEGA_RETABLECER: "S" },
      { where: { BODEGA: bodega } }
    );
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al restablecer el codigo de la bodega"),
    });
  }
};

// DELETE /fr/bodegaAsocRt/:bodega
const deleteBodegaAsocRt = async (req, res) => {
  const { bodega } = req.params;
  try {
    const data = await bodegaAsocRtModel.destroy({
      where: { BODEGA: bodega },
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: parseErrores(error, "Error al eliminar la asociacion de bodega"),
    });
  }
};

module.exports = {
  getBodegasAsocRt,
  getBodegaAsocRt,
  postBodegaAsocRt,
  putBodegaAsocRt,
  putRestablecerBodegaAsocRt,
  deleteBodegaAsocRt,
};
