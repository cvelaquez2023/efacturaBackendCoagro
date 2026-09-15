const { efectividadVisitaModel } = require("../../models");

const getEfectividadVisitas = async (req, res) => {
  try {
    const data = await efectividadVisitaModel.findAll({ raw: true });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al consultar las razones de efectividad", error.message],
    });
  }
};

const getEfectividadVisita = async (req, res) => {
  const { efectVisita } = req.params;
  try {
    const data = await efectividadVisitaModel.findOne({
      where: { EFECT_VISITA: efectVisita },
      raw: true,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al consultar la razón de efectividad", error.message],
    });
  }
};

const postEfectividadVisita = async (req, res) => {
  try {
    const { efectVisita, descripcion } = req.body;

    const data = await efectividadVisitaModel.create({
      EFECT_VISITA: efectVisita,
      DESCRIPCION: descripcion,
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al crear la razón de efectividad", error.message],
    });
  }
};

const putEfectividadVisita = async (req, res) => {
  const { efectVisita } = req.params;
  try {
    const { descripcion } = req.body;

    const data = await efectividadVisitaModel.update(
      { DESCRIPCION: descripcion },
      { where: { EFECT_VISITA: efectVisita } }
    );
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al actualizar la razón de efectividad", error.message],
    });
  }
};

const deleteEfectividadVisita = async (req, res) => {
  const { efectVisita } = req.params;
  try {
    const data = await efectividadVisitaModel.destroy({
      where: { EFECT_VISITA: efectVisita },
    });
    res.send({ result: data, success: true });
  } catch (error) {
    console.log(error);
    res.send({
      result: {},
      success: false,
      errors: ["Error al eliminar la razón de efectividad", error.message],
    });
  }
};

module.exports = {
  getEfectividadVisitas,
  getEfectividadVisita,
  postEfectividadVisita,
  putEfectividadVisita,
  deleteEfectividadVisita,
};
