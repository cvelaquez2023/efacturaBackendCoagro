const { sequelize } = require("../config/mssql");
const { encrypt } = require("../utils/handlePassword");

const getEmpresa = async (req, res) => {
  try {
    const _empresaId = req.params.id;
    const _data = await sequelize.query(
      `select * from dte.dbo.empresa where Empresa_id=${_empresaId} `,
      {
        type: sequelize.QueryTypes.SELECT,
      }
    );
    res.send({ result: _data, success: true });
  } catch (error) {
    console.log(error);
  }
};

const postEmpresa = async (req, res) => {
  try {
    const {
      nombre,
      nit,
      nrc,
      codActividad,
      desActividad,
      nombreComercial,
      tipoestablecimiento,
      departamento,
      municipio,
      complementoDir,
      telefono,
      correoDte,
      codestableceMh,
      codestable,
      codPuntoVentaMh,
      codPuntoVenta,
      userApi,
      pwdApi,
      pwdPrivado,
      pwdPublica,
      ambiente,
      versionDte01,
      versionDte03,
      versionDte05,
      versionDte06,
      versionDte07,
      versionDte08,
      versionDte09,
      versionDte11,
      versionDte14,
      versionDte15,
      emailEnvioDte,
      emailEnvioDtePass,
    } = req.body;

    const _pwdApi = await encrypt(pwdApi);
    const _pwdPrivada = await encrypt(pwdPrivado);
    const _pwdPublica = await encrypt(pwdPublica);

    const _data = await sequelize.query(
      `insert into dte.dbo.empresa ( nombre,nit,nrc,codActividad,desActividad,nombreComercial,tipoestablecimiento,departamento,municipio,complementoDir,telefono,correoDte,codestableceMh,codestable,codPuntoVentaMh,codPuntoVenta,userApi,pwdApi,pwdPrivado,pwdPublica,ambiente,versionDte01,versionDte03,versionDte05,versionDte06,versionDte07,versionDte08,versionDte09,versionDte11,versionDte14,versionDte15,emailEnvioDte,emailEnvioDtePass)  values ('${nombre}','${nit}','${nrc}','${codActividad}','${desActividad}','${nombreComercial}','${tipoestablecimiento}','${departamento}','${municipio}','${complementoDir}','${telefono}','${correoDte}','${codestableceMh}','${codestable}','${codPuntoVentaMh}','${codPuntoVenta}','${userApi}','${_pwdApi}','${_pwdPrivada}','${_pwdPublica}','${ambiente}',${versionDte01},${versionDte03},${versionDte05},${versionDte06},${versionDte07},${versionDte08},${versionDte09},${versionDte11},${versionDte14},${versionDte15},'${emailEnvioDte}','${emailEnvioDtePass}')  `,
      {
        type: sequelize.QueryTypes.SELECT,
      }
    );
    res.send({ result: _data, success: true });
  } catch (error) {
    console.log(error);
  }
};

module.exports = { getEmpresa, postEmpresa };
