const { SqlProveedor, Sqlempresa, SqlBuscarProveedores } = require("../../sqltx/sql");

// GET /proveedor?q=texto&limit=30
// Lista proveedores del ERP de la empresa del usuario para la lupa de Sujeto Excluido.
const buscarProveedoresSoftland = async (req, res) => {
  try {
    const User = req.cliente;
    const empresa = await Sqlempresa(User[0].empresa);
    const esquema = String((empresa[0] && empresa[0].esquemaBD) || "").trim();
    const texto = String(req.query.q || "").trim().slice(0, 60);
    const limite = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
    const proveedores = await SqlBuscarProveedores(texto, esquema, limite);
    res.send({ result: proveedores, success: true });
  } catch (error) {
    console.log(error);
    res.send({ result: [], success: false, errors: ["Error al buscar proveedores del ERP"] });
  }
};

const getProveedorSoftland = async (req, res) => {
const User = req.cliente;

  const empresa = await Sqlempresa(User[0].empresa)
 
      try {
        const proveedor = await SqlProveedor(req.params.id,empresa[0].esquemaBD)
        if (proveedor.length > 0) {
            res.send({ result: proveedor, success: true });
        } else {
            res.send({ result: ['no existe'], success: false });
        }

    } catch (error) {
        console.log(error);
    }
};
module.exports = { getProveedorSoftland, buscarProveedoresSoftland };