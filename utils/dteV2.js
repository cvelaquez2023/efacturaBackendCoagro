/**
 * Ajusta un DTE armado con la estructura v1 a la Normativa DTE v2.0 (MH 2026).
 *
 * Trabaja sobre una COPIA: el objeto original (resumen con ivaRete1, etc.)
 * se sigue usando para guardar en BD, cuyas columnas no cambian.
 *
 * Solo se llama cuando la empresa ya está en v2 (esV2 en config/MH.js).
 * Lo que no cumpla el esquema lo reporta utils/validaDte.js al firmar.
 */

const renombrar = (obj, de, a) => {
  if (obj && de in obj) {
    if (!(a in obj)) obj[a] = obj[de];
    delete obj[de];
  }
};

// Tipos cuyo resumen v2 NO lleva ivaPerci
const SIN_IVA_PERCI = ["01"];
// Único tipo que conserva reteRenta en v2 (Sujeto Excluido)
const CON_RETE_RENTA = ["14"];
// Único tipo que conserva la sección extension en v2 (Doc. Contable de Liquidación)
const CON_EXTENSION = ["09"];

const redondear = (n, dec) => {
  const f = 10 ** dec;
  return Math.round((Number(n) || 0) * f) / f;
};

// Deja solo las claves permitidas, en ese orden
const soloCampos = (obj, campos) =>
  Object.fromEntries(campos.filter((k) => k in obj).map((k) => [k, obj[k]]));

const CAMPOS_ITEM_NC = [
  "numItem", "tipoItem", "numeroDocumento", "cantidad", "codigo", "codTributo",
  "uniMedida", "descripcion", "precioUni", "montoDescu", "ventaNoSuj",
  "ventaExenta", "ventaGravada", "tributos", "noGravado", "ivaPerci",
  "totalIva", "ivaRete",
];
const CAMPOS_RESUMEN_NC = [
  "totalNoSuj", "totalExenta", "totalGravada", "subTotalVentas", "totalDescu",
  "tributos", "montoTotalOperacion", "ivaPerci", "totalIva", "ivaRete",
  "totalNoGravado", "totalPagar", "totalLetras", "condicionOperacion",
  "observaciones", "codigoRetencionMH",
];

/**
 * Nota de Crédito v4 (ajustando CCF, que es como la usa COAGRO):
 * - El IVA 13% sigue en tributos ("20"), por eso totalIva = 0.
 * - ivaPerci del resumen se reparte en los ítems según ventaGravada.
 * - ivaRete = 0 (igual que v1) y codigoRetencionMH = null.
 * Reglas de negocio a confirmar en apitest (Fase 6).
 */
const notaCreditoV2 = (d) => {
  d.identificacion.fusion = d.identificacion.fusion ?? null;

  const r = d.resumen || {};
  const items = Array.isArray(d.cuerpoDocumento) ? d.cuerpoDocumento : [];
  const ivaPerci = redondear(r.ivaPerci, 2);
  const totalGravado = items.reduce((s, i) => s + (Number(i.ventaGravada) || 0), 0);

  let repartido = 0;
  d.cuerpoDocumento = items.map((item, idx) => {
    let perci = 0;
    if (ivaPerci > 0 && totalGravado > 0) {
      perci =
        idx === items.length - 1
          ? redondear(ivaPerci - repartido, 2) // el último absorbe el redondeo
          : redondear((ivaPerci * (Number(item.ventaGravada) || 0)) / totalGravado, 2);
      repartido = redondear(repartido + perci, 2);
    }
    return soloCampos(
      {
        noGravado: 0,
        ...item,
        ivaPerci: perci,
        totalIva: 0,
        ivaRete: 0,
      },
      CAMPOS_ITEM_NC
    );
  });

  const ivaRete = redondear(r.ivaRete, 2);
  d.resumen = soloCampos(
    {
      ...r,
      ivaPerci,
      totalIva: 0,
      ivaRete,
      totalNoGravado: r.totalNoGravado ?? 0,
      totalPagar: redondear((r.montoTotalOperacion || 0) - ivaRete, 2),
      observaciones: r.observaciones ?? null,
      codigoRetencionMH: r.codigoRetencionMH ?? null,
    },
    CAMPOS_RESUMEN_NC
  );
  return d;
};

/**
 * Factura de Exportación v3:
 * - ventaTercero y compraTercero deben venir (null); el esquema usa oneOf sobre ellos.
 * - Ítems: tipoItem (1 = bien), numeroDocumento y codTributo.
 * - Resumen: "descuento" (descuento global en v1) pasa a descuGravada; nuevos
 *   tributos, totalNoOnerosas y saldoFavor.
 */
const exportacionV2 = (d) => {
  const raiz = {
    identificacion: d.identificacion,
    documentoRelacionado: d.documentoRelacionado ?? null,
    emisor: d.emisor,
    receptor: d.receptor,
    otrosDocumentos: d.otrosDocumentos ?? null,
    ventaTercero: d.ventaTercero ?? null,
    compraTercero: d.compraTercero ?? null,
    cuerpoDocumento: (d.cuerpoDocumento || []).map((item) => ({
      numItem: item.numItem,
      tipoItem: item.tipoItem ?? 1,
      numeroDocumento: item.numeroDocumento ?? null,
      cantidad: item.cantidad,
      codigo: item.codigo,
      codTributo: item.codTributo ?? null,
      uniMedida: item.uniMedida,
      descripcion: item.descripcion,
      precioUni: item.precioUni,
      montoDescu: item.montoDescu,
      ventaGravada: item.ventaGravada,
      tributos: item.tributos ?? null,
      noGravado: item.noGravado ?? 0,
    })),
    resumen: d.resumen,
    apendice: d.apendice ?? null,
  };
  const r = { ...raiz.resumen };
  renombrar(r, "descuento", "descuGravada");
  r.descuGravada = r.descuGravada ?? 0;
  r.tributos = r.tributos ?? null;
  r.totalNoOnerosas = r.totalNoOnerosas ?? 0;
  r.saldoFavor = r.saldoFavor ?? 0;
  raiz.resumen = r;
  return raiz;
};

/**
 * Factura de Sujeto Excluido v2:
 * - La sección "sujetoExcluido" pasa a llamarse "receptor".
 * - El resumen conserva reteRenta pero ya no lleva ivaRete.
 * - El emisor armado desde BD (reenvío) puede traer campos MH de v1.
 */
const sujetoExcluidoV2 = (d) => {
  const raiz = {
    identificacion: d.identificacion,
    emisor: d.emisor,
    receptor: d.receptor ?? d.sujetoExcluido,
    cuerpoDocumento: (d.cuerpoDocumento || []).flat(), // [[item]] -> [item]
    resumen: d.resumen,
    apendice: d.apendice ?? null,
  };
  if (raiz.emisor) {
    delete raiz.emisor.tipoEstablecimiento;
    delete raiz.emisor.codEstableMH;
    delete raiz.emisor.codPuntoVentaMH;
  }
  if (raiz.resumen) delete raiz.resumen.ivaRete;
  return raiz;
};

/**
 * Apéndice v2: máximo 10 elementos; campo ≤25, etiqueta ≤50, valor ≤150 y,
 * en NC v4 / FEX v3, sin valores vacíos. Se recorta y se quitan los vacíos.
 * El texto completo sigue en dte.dbo.apendice (de ahí sale el PDF).
 */
const limpiarApendice = (apendice) => {
  if (!Array.isArray(apendice)) return apendice ?? null;
  const texto = (v, max) => (v === null || v === undefined ? "" : String(v).trim().slice(0, max));
  const limpio = apendice
    .map((a) => ({
      campo: texto(a.campo, 25),
      etiqueta: texto(a.etiqueta, 50),
      valor: texto(a.valor, 150),
    }))
    .filter((a) => a.campo && a.etiqueta && a.valor)
    .slice(0, 10);
  return limpio.length ? limpio : null;
};

// Observaciones del apéndice -> resumen.observaciones (campo propio en v2, hasta 3000)
const observacionesDeApendice = (apendice) => {
  if (!Array.isArray(apendice)) return null;
  const obs = apendice.find((a) => a.campo === "OBSERVACIONES");
  const valor = obs && obs.valor !== null && obs.valor !== undefined ? String(obs.valor).trim() : "";
  return valor && valor !== "ND" ? valor.slice(0, 3000) : null;
};

const aV2 = (dte, tipoDte) => {
  const d = JSON.parse(JSON.stringify(dte));

  if ("apendice" in d) {
    const obs = observacionesDeApendice(d.apendice);
    if (d.resumen && !d.resumen.observaciones && obs) d.resumen.observaciones = obs;
    d.apendice = limpiarApendice(d.apendice);
  }

  if (!CON_EXTENSION.includes(tipoDte)) delete d.extension;

  const r = d.resumen;
  if (r) {
    renombrar(r, "ivaRete1", "ivaRete");
    renombrar(r, "ivaPerci1", "ivaPerci");
    if (SIN_IVA_PERCI.includes(tipoDte)) delete r.ivaPerci;
    if (!CON_RETE_RENTA.includes(tipoDte)) delete r.reteRenta;
    if (!("observaciones" in r)) r.observaciones = null;
  }

  // "lote" es un dato interno (cuerpoDocLote, para BD); nunca va a Hacienda
  if (Array.isArray(d.cuerpoDocumento)) {
    d.cuerpoDocumento.forEach((item) => delete item.lote);
  }

  if (tipoDte === "05") return notaCreditoV2(d);
  if (tipoDte === "11") return exportacionV2(d);
  if (tipoDte === "14") return sujetoExcluidoV2(d);

  return d;
};

module.exports = { aV2 };
