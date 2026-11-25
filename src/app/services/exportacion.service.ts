import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  PeliculaVistaPeriodo,
  ReporteCandyBar,
  ResumenFacturacion,
} from './reportes.service';

export interface PayloadExportacionAdmin {
  facturacion: ResumenFacturacion;
  peliculasVistas: PeliculaVistaPeriodo[];
  agrupacionPeliculas: 'semana' | 'mes';
  candyBar: ReporteCandyBar;
  logs: any[];
  rangoTexto?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ExportacionService {
  /**
   * Exporta un libro Excel (.xlsx) con hojas separadas para cada bloque del reporte
   */
  exportarExcel(data: PayloadExportacionAdmin, nombreArchivo = 'markacine-reporte-admin'): void {
    const wb = XLSX.utils.book_new();

    // 1. Hoja de Resumen y Facturación
    const filasFacturacion = [
      {
        Concepto: 'Total Facturado ($)',
        Valor: data.facturacion.totalFacturado,
      },
      {
        Concepto: 'Cantidad de Órdenes',
        Valor: data.facturacion.cantidadOrdenes,
      },
      {
        Concepto: 'Producto Candy Bar Más Vendido',
        Valor: data.candyBar.productoMasVendido
          ? `${data.candyBar.productoMasVendido.nombre} (${data.candyBar.productoMasVendido.cantidadVendida} u.)`
          : 'Sin ventas registradas',
      },
    ];
    const wsResumen = XLSX.utils.json_to_sheet(filasFacturacion);
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

    const filasOrdenes = (data.facturacion.ordenes || []).map((o) => ({
      CodigoRetiro: o.codigo_retiro,
      Estado: o.estado,
      MetodoPago: o.metodo_pago || 'N/A',
      Total: Number(o.total) || 0,
      Fecha: o.created_at ? new Date(o.created_at).toLocaleString('es-AR') : '',
    }));
    const wsOrdenes = XLSX.utils.json_to_sheet(
      filasOrdenes.length > 0 ? filasOrdenes : [{ Mensaje: 'Sin órdenes en el período' }],
    );
    XLSX.utils.book_append_sheet(wb, wsOrdenes, 'Facturacion');

    // 2. Hoja de Películas Más Vistas (solo entradas retiradas)
    const filasPeliculas = (data.peliculasVistas || []).map((p) => ({
      Periodo: p.etiquetaPeriodo,
      Pelicula: p.peliculaNombre,
      EntradasRetiradasVistas: p.vistas,
    }));
    const wsPeliculas = XLSX.utils.json_to_sheet(
      filasPeliculas.length > 0
        ? filasPeliculas
        : [{ Mensaje: 'Sin entradas retiradas en el período' }],
    );
    XLSX.utils.book_append_sheet(
      wb,
      wsPeliculas,
      data.agrupacionPeliculas === 'mes' ? 'Vistas_Mes' : 'Vistas_Semana',
    );

    // 3. Hoja de Candy Bar
    const filasCandy = (data.candyBar.ranking || []).map((item, idx) => ({
      Puesto: idx + 1,
      Producto: item.nombre,
      UnidadesVendidas: item.cantidadVendida,
      RecaudacionEstimada: item.recaudacionEstimada,
    }));
    const wsCandy = XLSX.utils.json_to_sheet(
      filasCandy.length > 0 ? filasCandy : [{ Mensaje: 'Sin productos vendidos' }],
    );
    XLSX.utils.book_append_sheet(wb, wsCandy, 'CandyBar');

    // 4. Hoja de Log de Actividad
    const filasLogs = (data.logs || []).map((log) => ({
      FechaHora: log.fecha_hora ? new Date(log.fecha_hora).toLocaleString('es-AR') : '',
      Accion: log.accion,
      Usuario: log.usuario_email || log.usuario_id || 'Sistema/Admin',
      Entidad: log.entidad,
      Detalle: log.detalle,
    }));
    const wsLogs = XLSX.utils.json_to_sheet(
      filasLogs.length > 0 ? filasLogs : [{ Mensaje: 'Sin actividad registrada' }],
    );
    XLSX.utils.book_append_sheet(wb, wsLogs, 'LogActividad');

    const fechaStamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${nombreArchivo}-${fechaStamp}.xlsx`);
  }

  /**
   * Exporta un PDF con resumen ejecutivo y tablas de facturación, vistas, candy bar y logs
   */
  exportarPDF(data: PayloadExportacionAdmin, nombreArchivo = 'markacine-reporte-admin'): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const fechaGeneracion = new Date().toLocaleString('es-AR');

    // Encabezado
    doc.setFontSize(16);
    doc.text('MarkaCine - Reporte de Administración', 14, 16);

    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(`Generado: ${fechaGeneracion}`, 14, 22);
    if (data.rangoTexto) {
      doc.text(`Período: ${data.rangoTexto}`, 14, 27);
    }
    doc.setTextColor(0);

    // Resumen rápido
    const topCandy = data.candyBar.productoMasVendido
      ? `${data.candyBar.productoMasVendido.nombre} (${data.candyBar.productoMasVendido.cantidadVendida} u.)`
      : 'N/A';

    doc.setFontSize(11);
    doc.text(
      `Total Facturado: $${data.facturacion.totalFacturado.toLocaleString('es-AR')}  |  Órdenes: ${data.facturacion.cantidadOrdenes}  |  Top Candy: ${topCandy}`,
      14,
      35,
    );

    let currentY = 42;

    // Tabla 1: Facturación por método de pago
    doc.setFontSize(12);
    doc.text('Facturación por Método de Pago', 14, currentY);
    autoTable(doc, {
      startY: currentY + 3,
      head: [['Método de Pago', 'Órdenes', 'Total ($)']],
      body:
        data.facturacion.porMetodoPago.length > 0
          ? data.facturacion.porMetodoPago.map((m) => [
              m.metodo,
              String(m.cantidad),
              `$${m.total.toLocaleString('es-AR')}`,
            ])
          : [['Sin datos', '0', '$0']],
    });
    currentY = (doc as any).lastAutoTable.finalY + 10;

    // Tabla 2: Películas más vistas (solo entradas retiradas)
    doc.setFontSize(12);
    doc.text(
      `Películas Más Vistas por ${data.agrupacionPeliculas === 'mes' ? 'Mes' : 'Semana'} (Entradas Retiradas)`,
      14,
      currentY,
    );
    autoTable(doc, {
      startY: currentY + 3,
      head: [['Período', 'Película', 'Vistas (Retiradas)']],
      body:
        data.peliculasVistas.length > 0
          ? data.peliculasVistas.map((p) => [
              p.etiquetaPeriodo,
              p.peliculaNombre,
              String(p.vistas),
            ])
          : [['-', 'Sin entradas retiradas registradas', '0']],
    });
    currentY = (doc as any).lastAutoTable.finalY + 10;

    // Tabla 3: Ranking Candy Bar
    doc.setFontSize(12);
    doc.text('Ranking Productos Candy Bar', 14, currentY);
    autoTable(doc, {
      startY: currentY + 3,
      head: [['#', 'Producto', 'Unidades Vendidas', 'Recaudación ($)']],
      body:
        data.candyBar.ranking.length > 0
          ? data.candyBar.ranking.map((item, i) => [
              String(i + 1),
              item.nombre,
              String(item.cantidadVendida),
              `$${item.recaudacionEstimada.toLocaleString('es-AR')}`,
            ])
          : [['-', 'Sin ventas de candy bar', '0', '$0']],
    });
    currentY = (doc as any).lastAutoTable.finalY + 10;

    // Tabla 4: Log de actividad
    doc.setFontSize(12);
    doc.text('Log de Actividad (Funciones, Precios y QR)', 14, currentY);
    autoTable(doc, {
      startY: currentY + 3,
      head: [['Fecha y Hora', 'Acción', 'Usuario', 'Detalle']],
      body:
        data.logs.length > 0
          ? data.logs.slice(0, 40).map((log) => [
              log.fecha_hora ? new Date(log.fecha_hora).toLocaleString('es-AR') : '',
              log.accion,
              log.usuario_email || log.usuario_id || 'Admin',
              log.detalle,
            ])
          : [['-', '-', '-', 'Sin registros de actividad']],
      styles: { fontSize: 8 },
    });

    const fechaStamp = new Date().toISOString().slice(0, 10);
    doc.save(`${nombreArchivo}-${fechaStamp}.pdf`);
  }
}