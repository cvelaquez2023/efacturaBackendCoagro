const { globalesRuteoModel } = require("../../models");

const getGlobalesRuteo = async (req, res) => {
  try {
    const data = await globalesRuteoModel.findOne({ raw: true });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al consultar los globales de ruteo"],
    });
  }
};

const postGlobalesRuteo = async (req, res) => {
  try {
    const existe = await globalesRuteoModel.findOne();
    if (existe) {
      return res.send({
        result: {},
        success: false,
        errors: ["Ya existe una configuracion de globales de ruteo"],
      });
    }

    const data = await globalesRuteoModel.create(req.body);
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al crear los globales de ruteo"],
    });
  }
};

const putGlobalesRuteo = async (req, res) => {
  try {
    const actual = await globalesRuteoModel.findOne();
    if (!actual) {
      return res.send({
        result: {},
        success: false,
        errors: ["No existe una configuracion de globales de ruteo"],
      });
    }

    const { CORP_NIT, ...cambios } = req.body;

    const data = await globalesRuteoModel.update(cambios, {
      where: { CORP_NIT: actual.CORP_NIT },
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al actualizar los globales de ruteo"],
    });
  }
};

const deleteGlobalesRuteo = async (req, res) => {
  try {
    const actual = await globalesRuteoModel.findOne();
    if (!actual) {
      return res.send({
        result: {},
        success: false,
        errors: ["No existe una configuracion de globales de ruteo"],
      });
    }

    const data = await globalesRuteoModel.destroy({
      where: { CORP_NIT: actual.CORP_NIT },
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al eliminar los globales de ruteo"],
    });
  }
};

module.exports = {
  getGlobalesRuteo,
  postGlobalesRuteo,
  putGlobalesRuteo,
  deleteGlobalesRuteo,
};
