const ExcelJS = require("exceljs");
const { Op } = require("sequelize");
const { sequelize } = require("../../config/mssql");
const {
  metaVentaProductoModel,
  lineaNegocioModel,
  liderModel,
  proveedorMetaModel,
  vendedorErpModel,
  articuloErpModel,
} = require("../../models");

/**
 * POST /fr/metaVentaProducto/importar[?validar=true]
 * Carga masiva de metas desde Excel (.xlsx, campo form-data "archivo").
 *
 * Columnas (por nombre de encabezado, sin importar orden/tildes/mayusculas):
 *   ano | Mes | Linea | Lider | codVendedor | codArticulos | Proveedor |
 *   Incentivo | MetaUnidades | Minimo
 * Linea/Lider/Proveedor vienen por CODIGO y se traducen a su id.
 *
 * Reglas acordadas:
 * - Todo o nada: si alguna fila tiene error no se inserta nada.
 * - Reemplazo por periodo: por cada Anio/Mes/Vendedor del archivo se borran
 *   sus metas actuales y se insertan las del Excel (una transaccion).
 * - Incentivo vacio -> 0. Minimo vacio -> MetaUnidades.
 * - ?validar=true: solo convierte y valida, no toca la BD.
 */

const MAX_ERRORES = 300;
const LOTE_INSERT = 150; // 2100 params max en SQL Server / ~13 columnas
const LOTE_IN = 1000;
const MAX_COD_PROVEEDOR = 20; // ProveedorMeta.codigo varchar(20)

// "Línea " -> "linea", "codVendedor" -> "codvendedor"
const normalizar = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// Encabezado normalizado -> campo interno. Prefijos para tolerar
// nombres cortados ("codVendedo") o variantes ("codArticulos").
const COLUMNAS = [
  { campo: "anio", alias: ["year", "periodo"], prefijos: ["ano", "anio"] },
  { campo: "mes", alias: ["mes"] },
  { campo: "linea", alias: ["linea", "lineanegocio", "codlinea"] },
  { campo: "lider", alias: ["lider", "codlider"] },
  { campo: "vendedor", prefijos: ["codvend", "vendedor"] },
  { campo: "articulo", prefijos: ["codart", "articulo"] },
  { campo: "proveedor", alias: ["proveedor", "codproveedor", "codprov"] },
  { campo: "incentivo", alias: ["incentivo"] },
  { campo: "meta", prefijos: ["meta"] },
  { campo: "minimo", alias: ["minimo", "minimounidades"] },
];
const OBLIGATORIAS = ["anio", "mes", "linea", "lider", "vendedor", "articulo", "proveedor", "meta"];
const NOMBRE_COLUMNA = {
  anio: "ano",
  mes: "Mes",
  linea: "Linea",
  lider: "Lider",
  vendedor: "codVendedor",
  articulo: "codArticulos",
  proveedor: "Proveedor",
  incentivo: "Incentivo",
  meta: "MetaUnidades",
  minimo: "Minimo",
};

const campoDeEncabezado = (texto) => {
  const n = normalizar(texto);
  if (!n) return null;
  const col = COLUMNAS.find(
    (c) => (c.alias && c.alias.includes(n)) || (c.prefijos && c.prefijos.some((p) => n.startsWith(p)))
  );
  return col ? col.campo : null;
};

// Valor "plano" de una celda de exceljs (formulas, texto enriquecido, etc).
const valorCelda = (v) => {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if (v.richText) return v.richText.map((t) => t.text).join("");
    if (v.result !== undefined) return valorCelda(v.result);
    if (v.text !== undefined) return valorCelda(v.text);
    if (v.error) return null;
    return null;
  }
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? null : t;
  }
  return v;
};

const texto = (v) => (v === null ? null : String(v).trim());

// Acepta 12, "12", "$0.032", "1,250.5". Devuelve NaN si no es numero.
const numero = (v) => {
  if (v === null) return null;
  if (typeof v === "number") return v;
  const limpio = String(v).replace(/[$,\s]/g, "");
  if (limpio === "") return null;
  return /^-?\d*\.?\d+(e-?\d+)?$/i.test(limpio) ? Number(limpio) : NaN;
};

// Codigos de catalogo: "001" y 1 deben coincidir (Excel suele perder
// los ceros si la celda es numerica con formato "000").
const clavesCodigo = (codigo) => {
  const t = String(codigo).trim().toUpperCase();
  const claves = [t];
  if (/^\d+$/.test(t)) claves.push(`#${Number(t)}`);
  return claves;
};
const mapaCatalogo = (filas) => {
  const mapa = new Map();
  filas.forEach((f) => clavesCodigo(f.codigo).forEach((k) => !mapa.has(k) && mapa.set(k, f)));
  return mapa;
};
const buscarCodigo = (mapa, codigo) => {
  for (const k of clavesCodigo(codigo)) if (mapa.has(k)) return mapa.get(k);
  return null;
};

const enLotes = (arr, n) => {
  const lotes = [];
  for (let i = 0; i < arr.length; i += n) lotes.push(arr.slice(i, i + n));
  return lotes;
};

const usuarioActual = (req) =>
  ((req.cliente && req.cliente[0] && req.cliente[0].email) || "").slice(0, 50) || "web";

// ---------------------------------------------------------------------------
// 1) Excel -> filas crudas
// ---------------------------------------------------------------------------
const leerExcel = async (buffer) => {
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(buffer);
  } catch (e) {
    return { error: "No se pudo leer el archivo. Debe ser un Excel .xlsx valido (guardar como 'Libro de Excel')." };
  }
  const hoja = libro.worksheets.find((h) => h.actualRowCount > 0);
  if (!hoja) return { error: "El archivo no tiene datos." };

  // Primera fila que tenga al menos 3 encabezados reconocibles.
  let filaEnc = null;
  let columnas = null;
  let leidos = [];
  for (let r = 1; r <= Math.min(hoja.rowCount, 20) && !filaEnc; r++) {
    const mapa = {};
    const textos = [];
    hoja.getRow(r).eachCell((celda, c) => {
      const t = valorCelda(celda.value);
      textos.push(JSON.stringify(t instanceof Date ? t.toISOString() : t));
      const campo = campoDeEncabezado(t);
      if (campo && !mapa[campo]) mapa[campo] = c;
    });
    if (Object.keys(mapa).length >= 3) {
      filaEnc = r;
      columnas = mapa;
      leidos = textos;
    }
  }
  if (!filaEnc) return { error: "No se encontro la fila de encabezados (ano, Mes, Linea, Lider, codVendedor...)." };

  const faltan = OBLIGATORIAS.filter((c) => !columnas[c]);
  if (faltan.length) {
    return {
      error:
        `Faltan columnas en el Excel: ${faltan.map((c) => NOMBRE_COLUMNA[c]).join(", ")}. ` +
        `Encabezados leidos en la fila ${filaEnc}: ${leidos.join(", ")}`,
    };
  }

  const filas = [];
  for (let r = filaEnc + 1; r <= hoja.rowCount; r++) {
    const row = hoja.getRow(r);
    const f = { fila: r };
    let vacia = true;
    Object.entries(columnas).forEach(([campo, c]) => {
      f[campo] = valorCelda(row.getCell(c).value);
      if (f[campo] !== null) vacia = false;
    });
    if (!vacia) filas.push(f);
  }
  return { filas };
};

// ---------------------------------------------------------------------------
// 2) Validacion + traduccion de codigos a ids
// ---------------------------------------------------------------------------
const validarFilas = async (filas) => {
  const errores = [];
  const err = (fila, msg) => errores.push(`Fila ${fila}: ${msg}`);

  const [lineas, lideres, proveedores] = await Promise.all([
    lineaNegocioModel.findAll({ attributes: ["id", "codigo", "nombre", "activa"], raw: true }),
    liderModel.findAll({ attributes: ["id", "codigo", "nombre", "activo"], raw: true }),
    proveedorMetaModel.findAll({ attributes: ["id", "codigo", "nombre", "activo"], raw: true }),
  ]);
  const mLineas = mapaCatalogo(lineas);
  const mLideres = mapaCatalogo(lideres);
  const mProveedores = mapaCatalogo(proveedores);

  const codVend = [...new Set(filas.map((f) => texto(f.vendedor)).filter(Boolean).map((v) => v.toUpperCase()))];
  const codArt = [...new Set(filas.map((f) => texto(f.articulo)).filter(Boolean))];

  const vendedores = new Map();
  for (const lote of enLotes(codVend, LOTE_IN)) {
    const rs = await vendedorErpModel.findAll({
      attributes: ["VENDEDOR", "NOMBRE", "ACTIVO"],
      where: { VENDEDOR: { [Op.in]: lote } },
      raw: true,
    });
    rs.forEach((v) => vendedores.set(v.VENDEDOR.trim().toUpperCase(), v));
  }
  const articulos = new Map();
  for (const lote of enLotes(codArt, LOTE_IN)) {
    const rs = await articuloErpModel.findAll({
      attributes: ["ARTICULO", "DESCRIPCION"],
      where: { ARTICULO: { [Op.in]: lote } },
      raw: true,
    });
    rs.forEach((a) => articulos.set(a.ARTICULO.trim().toUpperCase(), a));
  }

  const metas = [];
  const vistos = new Map(); // Anio|Mes|Vendedor|Articulo -> fila
  const nuevosProv = new Map(); // CODIGO -> { codigo, nombre, filas }

  for (const f of filas) {
    const n = errores.length;

    const anio = numero(f.anio);
    if (anio === null) err(f.fila, "falta el ano");
    else if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) err(f.fila, `ano invalido '${f.anio}'`);

    const mes = numero(f.mes);
    if (mes === null) err(f.fila, "falta el mes");
    else if (!Number.isInteger(mes) || mes < 1 || mes > 12) err(f.fila, `mes invalido '${f.mes}' (1 a 12)`);

    const resolver = (mapa, valor, nombre, campoActivo) => {
      if (valor === null) return err(f.fila, `falta ${nombre}`), null;
      const item = buscarCodigo(mapa, valor);
      if (!item) return err(f.fila, `${nombre} '${valor}' no existe`), null;
      if (item[campoActivo] === false) return err(f.fila, `${nombre} '${valor}' esta inactivo`), null;
      return item;
    };
    const linea = resolver(mLineas, texto(f.linea), "la linea de negocio", "activa");
    const lider = resolver(mLideres, texto(f.lider), "el lider", "activo");

    // Proveedor: si el codigo no existe se da de alta (codigo = nombre).
    // Cada vendedor maneja sus propios codigos; si se equivocan lo borran y
    // vuelven a subir el archivo.
    const codP = texto(f.proveedor);
    let prov = null;
    if (!codP) err(f.fila, "falta el proveedor");
    else {
      prov = buscarCodigo(mProveedores, codP);
      if (prov && prov.activo === false) {
        err(f.fila, `el proveedor '${codP}' esta inactivo`);
        prov = null;
      } else if (!prov) {
        if (codP.length > MAX_COD_PROVEEDOR) {
          err(f.fila, `el proveedor nuevo '${codP}' supera ${MAX_COD_PROVEEDOR} caracteres`);
        } else {
          const k = codP.toUpperCase();
          if (!nuevosProv.has(k)) nuevosProv.set(k, { codigo: codP, nombre: codP, filas: 0 });
          nuevosProv.get(k).filas++;
          const nuevo = nuevosProv.get(k);
          prov = { id: null, codigo: nuevo.codigo, nombre: nuevo.nombre, nuevo: true };
        }
      }
    }

    const codV = texto(f.vendedor);
    const vend = codV ? vendedores.get(codV.toUpperCase()) : null;
    if (!codV) err(f.fila, "falta el vendedor");
    else if (!vend) err(f.fila, `el vendedor '${codV}' no existe en el ERP`);
    else if (vend.ACTIVO !== "S") err(f.fila, `el vendedor '${codV}' esta inactivo en el ERP`);

    const codA = texto(f.articulo);
    const art = codA ? articulos.get(codA.toUpperCase()) : null;
    if (!codA) err(f.fila, "falta el articulo");
    else if (!art) err(f.fila, `el articulo '${codA}' no existe en el ERP`);

    const meta = numero(f.meta);
    if (meta === null) err(f.fila, "falta MetaUnidades");
    else if (Number.isNaN(meta) || meta < 0) err(f.fila, `MetaUnidades invalida '${f.meta}'`);

    let incentivo = numero(f.incentivo);
    if (incentivo === null) incentivo = 0;
    else if (Number.isNaN(incentivo) || incentivo < 0) err(f.fila, `Incentivo invalido '${f.incentivo}'`);

    let minimo = numero(f.minimo === undefined ? null : f.minimo);
    if (minimo === null) minimo = meta;
    else if (Number.isNaN(minimo) || minimo < 0) err(f.fila, `Minimo invalido '${f.minimo}'`);

    if (errores.length > n) continue;

    const llave = `${anio}|${mes}|${vend.VENDEDOR.trim()}|${art.ARTICULO.trim()}`.toUpperCase();
    if (vistos.has(llave)) {
      err(f.fila, `duplicada con la fila ${vistos.get(llave)} (mismo ano, mes, vendedor y articulo)`);
      continue;
    }
    vistos.set(llave, f.fila);

    metas.push({
      fila: f.fila,
      Anio: anio,
      Mes: mes,
      IdLineaNegocio: linea.id,
      IdLider: lider.id,
      Vendedor: vend.VENDEDOR.trim(),
      Articulo: art.ARTICULO.trim(),
      IdProveedor: prov.id, // null si es nuevo: se asigna al crearlo
      codigoProveedor: prov.codigo,
      proveedorNuevo: !!prov.nuevo,
      Meta_Unidades: meta,
      Incentivo: incentivo,
      minimo,
      // Solo informativo para la vista previa:
      lineaNegocio: `${linea.codigo} - ${linea.nombre}`,
      lider: `${lider.codigo} - ${lider.nombre}`,
      proveedor: `${prov.codigo} - ${prov.nombre}${prov.nuevo ? " (NUEVO)" : ""}`,
      vendedorNombre: vend.NOMBRE,
      articuloDescripcion: art.DESCRIPCION,
    });
  }

  return { metas, errores, proveedoresNuevos: [...nuevosProv.values()] };
};

// Periodos (Anio/Mes/Vendedor) del archivo y cuantas metas tienen hoy en BD.
const periodosDe = (metas) => {
  const mapa = new Map();
  metas.forEach((m) => {
    const k = `${m.Anio}|${m.Mes}|${m.Vendedor}`;
    if (!mapa.has(k)) mapa.set(k, { anio: m.Anio, mes: m.Mes, vendedor: m.Vendedor, filas: 0 });
    mapa.get(k).filas++;
  });
  return [...mapa.values()];
};
const wherePeriodos = (periodos) => ({
  [Op.or]: periodos.map((p) => ({ Anio: p.anio, Mes: p.mes, Vendedor: p.vendedor })),
});

const contarExistentes = async (periodos, transaction) => {
  let total = 0;
  for (const lote of enLotes(periodos, 500)) {
    total += await metaVentaProductoModel.count({ where: wherePeriodos(lote), transaction });
  }
  return total;
};

const mensajeProveedores = (nuevos, verbo) =>
  nuevos.length
    ? `${verbo} ${nuevos.length} proveedor(es) nuevo(s): ${nuevos.map((p) => p.codigo).join(", ")}. ` +
      "Si alguno es un error de digitacion, borrelo y vuelva a subir el archivo."
    : "No hay proveedores nuevos.";

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------
const importarMetasVenta = async (req, res) => {
  const soloValidar = ["true", "1", "s", "si"].includes(String(req.query.validar || "").toLowerCase());
  try {
    if (!req.file) {
      return res.send({ result: {}, success: false, errors: ["Debe adjuntar el archivo Excel en el campo 'archivo'."] });
    }

    const leido = await leerExcel(req.file.buffer);
    if (leido.error) return res.send({ result: {}, success: false, errors: [leido.error] });
    if (!leido.filas.length) {
      return res.send({ result: {}, success: false, errors: ["El Excel no tiene filas de metas."] });
    }

    const { metas, errores, proveedoresNuevos } = await validarFilas(leido.filas);
    const periodos = periodosDe(metas);
    const resumen = {
      filasLeidas: leido.filas.length,
      filasValidas: metas.length,
      filasConError: leido.filas.length - metas.length,
      vendedores: new Set(metas.map((m) => m.Vendedor)).size,
      periodos: periodos.length,
      proveedoresNuevos: proveedoresNuevos.length,
    };

    if (errores.length) {
      return res.send({
        result: { resumen },
        success: false,
        errors: errores.length > MAX_ERRORES
          ? [...errores.slice(0, MAX_ERRORES), `... y ${errores.length - MAX_ERRORES} errores mas`]
          : errores,
      });
    }

    if (soloValidar) {
      resumen.metasExistentesAReemplazar = await contarExistentes(periodos);
      return res.send({
        result: {
          resumen,
          mensaje: mensajeProveedores(proveedoresNuevos, "Se crearan"),
          proveedoresNuevos,
          periodos,
          metas,
        },
        success: true,
      });
    }

    const usuario = usuarioActual(req);
    const t = await sequelize.transaction();
    try {
      // 1) Alta de proveedores nuevos (dentro de la transaccion: si algo
      //    falla despues, tampoco quedan creados).
      const idsNuevos = new Map();
      for (const p of proveedoresNuevos) {
        const creado = await proveedorMetaModel.create(
          { codigo: p.codigo, nombre: p.nombre, activo: true, UsuarioCreacion: usuario },
          { fields: ["codigo", "nombre", "activo", "UsuarioCreacion"], transaction: t }
        );
        p.id = creado.id;
        idsNuevos.set(p.codigo.toUpperCase(), creado.id);
      }
      metas.forEach((m) => {
        if (m.proveedorNuevo) m.IdProveedor = idsNuevos.get(m.codigoProveedor.toUpperCase());
      });

      let reemplazadas = 0;
      for (const lote of enLotes(periodos, 500)) {
        reemplazadas += await metaVentaProductoModel.destroy({ where: wherePeriodos(lote), transaction: t });
      }

      const registros = metas.map((m) => ({
        Anio: m.Anio,
        Mes: m.Mes,
        IdLineaNegocio: m.IdLineaNegocio,
        IdLider: m.IdLider,
        Vendedor: m.Vendedor,
        Articulo: m.Articulo,
        IdProveedor: m.IdProveedor,
        Meta_Unidades: m.Meta_Unidades,
        Incentivo: m.Incentivo,
        minimo: m.minimo,
        UsuarioCreacion: usuario,
      }));
      // FechaCreacion la pone la BD (default getdate()); por eso va fuera de fields.
      const fields = Object.keys(registros[0]);
      for (const lote of enLotes(registros, LOTE_INSERT)) {
        await metaVentaProductoModel.bulkCreate(lote, { fields, validate: false, transaction: t });
      }

      await t.commit();
      return res.send({
        result: {
          resumen: { ...resumen, insertadas: registros.length, reemplazadas },
          mensaje: mensajeProveedores(proveedoresNuevos, "Se crearon"),
          proveedoresNuevos,
          periodos,
        },
        success: true,
      });
    } catch (error) {
      await t.rollback();
      throw error;
    }
  } catch (error) {
    console.log(error);
    const errores = ["Error al importar las metas de venta. No se guardo ningun registro."];
    if (error.parent && error.parent.message) errores.push(error.parent.message);
    res.send({ result: {}, success: false, errors: errores });
  }
};

// ---------------------------------------------------------------------------
// GET /fr/metaVentaProducto/consulta?anio=&mes=
// "Manual" para la web antes de subir el Excel: plantilla, catalogos con sus
// codigos y periodos ya cargados (lo que se reemplazaria al volver a subir).
// Los articulos (~1400) no van aqui: buscar con GET /fr/articuloErp?q=.
// ---------------------------------------------------------------------------
const PLANTILLA = [
  { columna: "ano", obligatoria: true, ejemplo: 2026, descripcion: "Ano de la meta (2000 a 2100)." },
  { columna: "Mes", obligatoria: true, ejemplo: 11, descripcion: "Mes de la meta (1 a 12)." },
  { columna: "Linea", obligatoria: true, ejemplo: "001", descripcion: "Codigo de la linea de negocio. Debe existir y estar activa (ver lineasNegocio)." },
  { columna: "Lider", obligatoria: true, ejemplo: "001", descripcion: "Codigo del lider. Debe existir y estar activo (ver lideres)." },
  { columna: "codVendedor", obligatoria: true, ejemplo: "VBM", descripcion: "Codigo del vendedor del ERP. Debe existir y estar activo (ver vendedores)." },
  { columna: "codArticulos", obligatoria: true, ejemplo: "16021", descripcion: "Codigo del articulo del ERP. Consultar con GET /fr/articuloErp?q=." },
  { columna: "Proveedor", obligatoria: true, ejemplo: "CALOX", descripcion: `Codigo del proveedor (max ${MAX_COD_PROVEEDOR} caracteres). Si NO existe se crea automaticamente con nombre = codigo; revisar la lista de proveedores para no duplicar por error de digitacion.` },
  { columna: "Incentivo", obligatoria: false, ejemplo: 0.032, descripcion: "Incentivo por unidad. Vacio = 0." },
  { columna: "MetaUnidades", obligatoria: true, ejemplo: 10, descripcion: "Meta en unidades (mayor o igual a 0)." },
  { columna: "Minimo", obligatoria: false, ejemplo: 10, descripcion: "Minimo de unidades. Vacio = igual a MetaUnidades." },
];

const REGLAS = [
  "Solo archivos .xlsx de maximo 10 MB; se lee la primera hoja con datos.",
  "Los encabezados se reconocen por nombre (sin importar orden, tildes ni mayusculas).",
  "Todo o nada: si una fila tiene error no se guarda ninguna; se indica el numero de fila.",
  "Una misma combinacion ano/mes/vendedor/articulo no puede repetirse en el archivo.",
  "Volver a subir un ano/mes/vendedor REEMPLAZA todas sus metas anteriores.",
  "Use ?validar=true para ver la vista previa sin guardar.",
  "Proveedores nuevos se crean solos; si fue un error, borre las metas del periodo, el proveedor y vuelva a subir.",
];

const consultaMetasVenta = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    const wherePer = {};
    if (anio) wherePer.Anio = anio;
    if (mes) wherePer.Mes = mes;

    const [lineas, lideres, proveedores, vendedores, periodos] = await Promise.all([
      lineaNegocioModel.findAll({ attributes: ["id", "codigo", "nombre", "activa"], order: [["codigo", "ASC"]], raw: true }),
      liderModel.findAll({ attributes: ["id", "codigo", "nombre", "activo"], order: [["codigo", "ASC"]], raw: true }),
      proveedorMetaModel.findAll({ attributes: ["id", "codigo", "nombre", "activo"], order: [["codigo", "ASC"]], raw: true }),
      vendedorErpModel.findAll({
        attributes: ["VENDEDOR", "NOMBRE"],
        where: { ACTIVO: "S" },
        order: [["VENDEDOR", "ASC"]],
        raw: true,
      }),
      metaVentaProductoModel.findAll({
        attributes: [
          "Anio",
          "Mes",
          "Vendedor",
          [sequelize.fn("COUNT", sequelize.col("IdMeta")), "articulos"],
          [sequelize.fn("SUM", sequelize.col("Meta_Unidades")), "metaUnidades"],
          [sequelize.fn("MAX", sequelize.col("FechaCreacion")), "fechaCarga"],
          [sequelize.fn("MAX", sequelize.col("UsuarioCreacion")), "usuarioCarga"],
        ],
        where: wherePer,
        group: ["Anio", "Mes", "Vendedor"],
        order: [["Anio", "DESC"], ["Mes", "DESC"], ["Vendedor", "ASC"]],
        raw: true,
      }),
    ]);

    const nombreVend = new Map(vendedores.map((v) => [v.VENDEDOR.trim().toUpperCase(), v.NOMBRE]));
    periodos.forEach((p) => {
      p.vendedorNombre = nombreVend.get(String(p.Vendedor).trim().toUpperCase()) || null;
      p.metaUnidades = Number(p.metaUnidades);
    });

    res.send({
      result: {
        plantilla: PLANTILLA,
        reglas: REGLAS,
        lineasNegocio: lineas,
        lideres,
        proveedores,
        vendedores: vendedores.map((v) => ({ codigo: v.VENDEDOR.trim(), nombre: v.NOMBRE })),
        periodosCargados: periodos,
      },
      success: true,
    });
  } catch (error) {
    console.log(error);
    res.send({ result: {}, success: false, errors: ["Error al consultar la informacion de metas"] });
  }
};

module.exports = { importarMetasVenta, consultaMetasVenta, leerExcel, validarFilas };
