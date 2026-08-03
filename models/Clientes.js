const { sequelize } = require("../config/mssql");
const { DataTypes } = require("sequelize");

const Cliente = sequelize.define(
  "CLIENTE",
  {
    CLIENTE: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    NOMBRE: {
      type: DataTypes.STRING,
    },
    ALIAS: {
      type: DataTypes.STRING,
    },
    CONTACTO: {
      type: DataTypes.STRING,
    },
    CARGO: {
      type: DataTypes.STRING,
    },
    DIRECCION: {
      type: DataTypes.STRING,
    },
    TELEFONO1: {
      type: DataTypes.STRING,
    },
    CONTRIBUYENTE: {
      type: DataTypes.STRING,
    },
    FECHA_INGRESO: {
      type: DataTypes.STRING,
    },
    MULTIMONEDA: {
      type: DataTypes.STRING,
    },
    MONEDA: {
      type: DataTypes.STRING,
    },
    SALDO: {
      type: DataTypes.DECIMAL,
    },
    SALDO_LOCAL: {
      type: DataTypes.DECIMAL,
    },
    SALDO_DOLAR: {
      type: DataTypes.DECIMAL,
    },
    SALDO_CREDITO: {
      type: DataTypes.DECIMAL,
    },
    EXCEDER_LIMITE: {
      type: DataTypes.STRING,
    },
    TASA_INTERES: {
      type: DataTypes.DECIMAL,
    },
    Tasa_Interes_Mora: {
      type: DataTypes.STRING,
    },
    Fecha_Ult_Mora: {
      type: DataTypes.STRING,
    },
    Fecha_Ult_Mov: {
      type: DataTypes.STRING,
    },
    Condicion_Pago: {
      type: DataTypes.STRING,
    },
    Nivel_Precio: {
      type: DataTypes.STRING,
    },
    Descuento: {
      type: DataTypes.DECIMAL,
    },
    Moneda_Nivel: {
      type: DataTypes.STRING,
    },
    Acepta_Backorder: {
      type: DataTypes.STRING,
    },
    Pais: {
      type: DataTypes.STRING,
    },
    Zona: {
      type: DataTypes.STRING,
    },
    Ruta: {
      type: DataTypes.STRING,
    },
    Vendedor: {
      type: DataTypes.STRING,
    },
    Cobrador: {
      type: DataTypes.STRING,
    },
    Acepta_Fracciones: {
      type: DataTypes.STRING,
    },
    Activo: {
      type: DataTypes.STRING,
    },
    Exento_Impuestos: {
      type: DataTypes.STRING,
    },
    Exencion_Imp1: {
      type: DataTypes.DECIMAL,
    },
    Exencion_Imp2: {
      type: DataTypes.DECIMAL,
    },
    Cobro_Judicial: {
      type: DataTypes.STRING,
    },
    Categoria_Cliente: {
      type: DataTypes.STRING,
    },
    Clase_ABC: {
      type: DataTypes.STRING,
    },
    Dias_Abastecimien: {
      type: DataTypes.INTEGER,
    },
    Usa_Tarjeta: {
      type: DataTypes.STRING,
    },
    Tarjeta_Credito: {
      type: DataTypes.STRING,
    },
    Fecha_Vence_Tarj: {
      type: DataTypes.STRING,
    },
    E_Mail: {
      type: DataTypes.STRING,
    },
    Requiere_Oc: {
      type: DataTypes.STRING,
    },
    Es_Corporacion: {
      type: DataTypes.STRING,
    },
    RegistrarDocsACorp: {
      type: DataTypes.STRING,
    },
    Usar_Diremb_Corp: {
      type: DataTypes.STRING,
    },
    Aplicac_Abiertas: {
      type: DataTypes.STRING,
    },
    Verif_Limcred_Corp: {
      type: DataTypes.STRING,
    },
    Usar_Desc_Corp: {
      type: DataTypes.STRING,
    },
    Doc_A_Generar: {
      type: DataTypes.STRING,
    },
    Tiene_Convenio: {
      type: DataTypes.STRING,
    },
    Notas: {
      type: DataTypes.STRING,
    },
    Dias_Promed_Atraso: {
      type: DataTypes.DECIMAL,
    },
    ASOCOBLIGCONTFACT: {
      type: DataTypes.STRING,
    },
    Usar_Precios_Corp: {
      type: DataTypes.STRING,
    },
    Usar_ExenCimp_Corp: {
      type: DataTypes.STRING,
    },
    Ajuste_Fecha_Cobro: {
      type: DataTypes.STRING,
    },
    Clase_Documento: {
      type: DataTypes.STRING,
    },
    Local: {
      type: DataTypes.STRING,
    },
    Tipo_Contribuyente: {
      type: DataTypes.STRING,
    },
    Acepta_Doc_Electronico: {
      type: DataTypes.STRING,
    },
    Confirma_Doc_Electronico: {
      type: DataTypes.STRING,
    },
    Acepta_Doc_Edi: {
      type: DataTypes.STRING,
    },
    Notificar_Error_Edi: {
      type: DataTypes.STRING,
    },
    Codigo_Impuesto: {
      type: DataTypes.STRING,
    },
    Moroso: {
      type: DataTypes.STRING,
    },
    Modif_Nomb_En_Fac: {
      type: DataTypes.STRING,
    },
    Saldo_Trans: {
      type: DataTypes.DECIMAL,
    },
    Saldo_Trans_Local: {
      type: DataTypes.DECIMAL,
    },
    Saldo_Trans_Dolar: {
      type: DataTypes.DECIMAL,
    },
    Permite_Doc_GP: {
      type: DataTypes.STRING,
    },
    Participa_FlujoCaja: {
      type: DataTypes.STRING,
    },
    Detallar_Kits: {
      type: DataTypes.STRING,
    },
    Es_Extranjero: {
      type: DataTypes.STRING,
    },
    Es_Agente_Percepcion: {
      type: DataTypes.STRING,
    },
    Es_Buen_Contribuyente: {
      type: DataTypes.STRING,
    },
    Sujeto_Porce_Sunat: {
      type: DataTypes.STRING,
    },
  
    RUBRO1_CLI: {
      type: DataTypes.STRING,
    },
    RUBRO2_CLI: {
      type: DataTypes.STRING,
    },
    //DOCUMENTO
    RUBRO3_CLI: {
      type: DataTypes.STRING,
    },
    //GENERO
    RUBRO4_CLI: {
      type: DataTypes.STRING,
    },
    //FECHA NACIMIENTO
    RUBRO5_CLI: {
      type: DataTypes.STRING,
    },
    RUBRO7_CLIENTE: {
      type: DataTypes.STRING,
    },
    RUBRO8_CLIENTE: {
      type: DataTypes.STRING,
    },
    RUBRO9_CLIENTE: {
      type: DataTypes.STRING,
    },
  },
  { timestamps: false, hasTrigger: true }
);

module.exports = Cliente;
