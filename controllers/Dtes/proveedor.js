const { SqlProveedor, Sqlempresa } = require("../../sqltx/sql");

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
module.exports = { getProveedorSoftland };