const { Sequelize } = require("sequelize");
const { clasiModel } = require("../models");

const { handleHttpError } = require("../utils/handleError");

const Op = Sequelize.Op;
const getItems = async (req, res) => {
  try {
    const user = req.cliente;

    const agru = req.query.agrupacion;

    const erros = [];
    if (agru == null) {
      const data = await clasiModel.findAll();
      res.send({ resuls: data, result: "true", error: erros });
    }
    if (agru == 1) {
      const data = await clasiModel.findAll({
        where: { AGRUPACION: 1, APORTE_CODIGO: "S" },
      });

      res.send({ resuls: data, result: "true", error: erros });
    }
    if (agru == 2) {
      const cat = await clasiModel.findAll({
        where: {
          AGRUPACION: agru,
          APORTE_CODIGO: "S",
        },
      });
      const subcate = await clasiModel.findAll();

      //const nuevo = new dataOri();
      let arreglo = new Array();

      for (let i = 0; i < cat.length; i++) {
        var obj = {};
        let arreglo2 = new Array();
        const element = cat[i];
        obj["Categoria"] = element.CLASIFICACION;
        obj["Desc"] = element.DESCRIPCION;
        obj["Imag1"] = element.IMAGEN1;
        obj["Imag2"] = element.IMAGEN2;
        obj["Imag3"] = element.IMAGEN3;
        obj["Imag4"] = element.IMAGEN4;
        obj["Imag5"] = element.IMAGEN5;
        obj["Slider"] = element.SLIDER;
        obj["Vistas"] = element.VISTAS;
        for (let x = 0; x < subcate.length; x++) {
          const element1 = subcate[x];
          //array de subCate
          if (element1.PADRE == element.CLASIFICACION) {
            let subcate = element1.CLASIFICACION;

            // aregloTipo(subcate).then((val) => (tipo = val));
            //let _data = aregloTipo(subcate).then((val) => val);
            const _data = await aregloTipo(subcate);
            const datos = {
              Clasi: element1.CLASIFICACION,
              Desc: element1.DESCRIPCION,
              Img1: element1.IMAGEN1,
              Img2: element1.IMAGEN2,
              Img3: element1.IMAGEN3,
              Img4: element1.IMAGEN4,
              Img5: element1.IMAGEN5,
              Slider: element1.SLIDER,
              Vistas: element1.VISTAS,
              Tipo: _data,
            };

            arreglo2.push(
              //array de tipo
              datos
            );

            obj["SubCategoria"] = arreglo2;
          }
        }

        arreglo.push(obj);
      }

      res.send({
        resuls: arreglo,
        usuario: user,
        result: "true",
        error: erros,
      });
    }
    if (agru == 3) {
      const data = await clasiModel.findAll({ where: { AGRUPACION: 3 } });
      res.send({ resuls: data, result: "true", error: erros });
    }
    if (agru == 4) {
      const data = await clasiModel.findAll({ where: { AGRUPACION: 4 } });
      res.send({ resuls: data, result: "true", error: erros });
    }
    if (agru == 5) {
      const data = await clasiModel.findAll({ where: { AGRUPACION: 5 } });
      res.send({ resuls: data, usario: user, result: "true", error: erros });
    }

    //    const data = await clasiModel.findAll();
  } catch (error) {
    handleHttpError(res, "ERROR EN GET_CLASI");
  }
};

const getItem = (req, res) => {};

const updateItem = async (req, res) => {
  try {
    const clasificacion = req.params.id;
    const user = req.cliente;

    const results = await clasiModel.update(
      {
        IMAGEN1: req.body.imagen1,
        IMAGEN2: req.body.imagen2,
        IMAGEN3: req.body.imagen3,
        IMAGEN4: req.body.imagen4,
        IMAGEN5: req.body.imagen5,
        SLIDER: req.body.Slider,
      },
      { where: { CLASIFICACION: clasificacion } }
    );

    res.send({ results, usuario: user });
  } catch (error) {
    console.log(error);
    handleHttpError(res, "ERROR_UPDATE_ITEM");
  }
};

async function aregloTipo(padre) {
  let arreglo3 = new Array();
  const tipo = await clasiModel.findAll({
    where: {
      AGRUPACION: "5",
    },
  });

  for (let y = 0; y < tipo.length; y++) {
    const elementy = tipo[y];
    if (elementy.PADRE == padre) {
      arreglo3.push({
        Clasi: elementy.CLASIFICACION,
        Desc: elementy.DESCRIPCION,
        Img1: elementy.IMAGEN1,
        Img2: elementy.IMAGEN2,
        Img3: elementy.IMAGEN3,
        Img4: elementy.IMAGEN4,
        Img5: elementy.IMAGEN5,
        Slider: elementy.SLIDER,
        Vistas: elementy.VISTAS,
      });
    }
  }

  return await arreglo3;
}
const putVisitas = async (req, res) => {
  try {
    const clas = req.query.clas;

    //consultamos las classificiones
    const data = await clasiModel.findOne({ where: { CLASIFICACION: clas } });
    if (data.VISITAS == null) {
      valor = 1;
    } else {
      valor = data.VISITAS + 1;
    }
    //actutalizamos la categorias
    console.log(data);
    const results = await clasiModel.update(
      {
        VISITAS: valor,
      },
      { where: { CLASIFICACION: clas } }
    );
    res.send({ results });
  } catch (error) {
    console.log(error);
  }
};

module.exports = { getItems, getItem, updateItem, putVisitas };
