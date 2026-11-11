const { sequelize } = require("../../config/mssql");
const { DataTypes } = require("sequelize");
const LineaNegocio = require("./LineaNegocio");
const Lider = require("./Lider");
const ProveedorMeta = require("./ProveedorMeta");
const VendedorErp = require("./VendedorErp");
const ArticuloErp = require("./ArticuloErp");

/**
 * CINCOH.MetaVentaProducto: meta de unidades por anio/mes/vendedor/articulo.
 * PK IdMeta (identity). UNIQUE (Anio, Mes, Vendedor, Articulo).
 * FKs: IdLineaNegocio -> LineaNegocio.id, IdLider -> Lider.id,
 * IdProveedor -> ProveedorMeta.id, Vendedor -> VENDEDOR, Articulo -> ARTICULO.
 */
const MetaVentaProducto = sequelize.define(
  "MetaVentaProducto",
  {
    IdMeta: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    Anio: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      validate: {
        isInt: { msg: "Anio debe ser un numero entero" },
        min: { args: [2000], msg: "Anio debe ser mayor o igual a 2000" },
        max: { args: [2100], msg: "Anio debe ser menor o igual a 2100" },
      },
    },
    Mes: {
      type: DataTypes.TINYINT,
      allowNull: false,
      validate: {
        isInt: { msg: "Mes debe ser un numero entero" },
        min: { args: [1], msg: "Mes debe estar entre 1 y 12" },
        max: { args: [12], msg: "Mes debe estar entre 1 y 12" },
      },
    },
    IdLineaNegocio: { type: DataTypes.INTEGER, allowNull: false },
    IdLider: { type: DataTypes.INTEGER, allowNull: false },
    Vendedor: {
      type: DataTypes.STRING(4),
      allowNull: false,
      validate: {
        len: { args: [1, 4], msg: "Vendedor admite un maximo de 4 caracteres" },
      },
    },
    Articulo: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        len: { args: [1, 20], msg: "Articulo admite un maximo de 20 caracteres" },
      },
    },
    IdProveedor: { type: DataTypes.INTEGER, allowNull: false },
    Meta_Unidades: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        isDecimal: { msg: "Meta_Unidades debe ser numerico" },
        min: { args: [0], msg: "Meta_Unidades no puede ser negativa" },
      },
    },
    Venta_Unidades: {
      type: DataTypes.DECIMAL(18, 2),
      validate: { isDecimal: { msg: "Venta_Unidades debe ser numerico" } },
    },
    Venta_Valor: {
      type: DataTypes.DECIMAL(18, 2),
      validate: { isDecimal: { msg: "Venta_Valor debe ser numerico" } },
    },
    FechaCreacion: { type: DataTypes.DATE },
    UsuarioCreacion: { type: DataTypes.STRING(50) },
    FechaModificacion: { type: DataTypes.DATE },
    UsuarioModificacion: { type: DataTypes.STRING(50) },
  },
  {
    schema: "CINCOH",
    timestamps: false,
  }
);

// Solo para mostrar nombres en los GET (constraints:false: las FK ya existen en BD).
MetaVentaProducto.belongsTo(LineaNegocio, { as: "lineaNegocio", foreignKey: "IdLineaNegocio", constraints: false });
MetaVentaProducto.belongsTo(Lider, { as: "lider", foreignKey: "IdLider", constraints: false });
MetaVentaProducto.belongsTo(ProveedorMeta, { as: "proveedor", foreignKey: "IdProveedor", constraints: false });
MetaVentaProducto.belongsTo(VendedorErp, { as: "vendedor", foreignKey: "Vendedor", targetKey: "VENDEDOR", constraints: false });
MetaVentaProducto.belongsTo(ArticuloErp, { as: "articulo", foreignKey: "Articulo", targetKey: "ARTICULO", constraints: false });

module.exports = MetaVentaProducto;
