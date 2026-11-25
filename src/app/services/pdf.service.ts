import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import { formatearFechaLocal, obtenerHoyLocal } from '../utils/fechas.util';

@Injectable({
  providedIn: 'root',
})
export class PdfService {
  private readonly FILAS_VIP = new Set(['R', 'S', 'T']);

  private esFilaVip(fila: string): boolean {
    return this.FILAS_VIP.has((fila || '').trim().toUpperCase());
  }

  private getPorcentajePreventa(funcionData?: any, porcentajeExplicit?: number): number {
    if (typeof porcentajeExplicit === 'number' && porcentajeExplicit > 0) {
      return porcentajeExplicit;
    }

    const p = funcionData?.peliculas;
    if (!p?.fecha_estreno) return 0;

    const hoy = obtenerHoyLocal();
    const estreno = formatearFechaLocal(p.fecha_estreno);
    if (!estreno || hoy >= estreno || !p.preventa_activa) return 0;

    const diasPreventa = Number(p.dias_preventa ?? 7);
    const [anio, mes, dia] = estreno.split('-').map(Number);
    const fechaInicioPreventa = formatearFechaLocal(
      new Date(anio, mes - 1, dia - diasPreventa)
    );

    if (hoy >= fechaInicioPreventa && hoy < estreno) {
      return Number(p.porcentaje_preventa ?? 50);
    }

    return 0;
  }

  private getMultiplicadorPreventa(
    funcionData?: any,
    enPreventa?: boolean,
    porcentajeExplicit?: number,
  ): number {
    if (enPreventa === false) return 1;
    const pct = this.getPorcentajePreventa(funcionData, porcentajeExplicit);
    if (enPreventa === true && pct <= 0) {
      return 1 + Number(funcionData?.peliculas?.porcentaje_preventa ?? 50) / 100;
    }
    return pct > 0 ? 1 + pct / 100 : 1;
  }

  private getPrecioBaseGeneralPesos(funcionData?: any): number {
    return Number(funcionData?.precio_pesos ?? 0);
  }

  private getPrecioGeneralPesos(funcionData?: any, multiplicador = 1): number {
    return Math.round(this.getPrecioBaseGeneralPesos(funcionData) * multiplicador);
  }

  private getPrecioVipPesos(funcionData?: any, multiplicador = 1): number {
    return Math.round(this.getPrecioBaseGeneralPesos(funcionData) * 2 * multiplicador);
  }

  private getPrecioAsientoPesos(funcionData: any, fila: string, multiplicador = 1): number {
    return this.esFilaVip(fila)
      ? this.getPrecioVipPesos(funcionData, multiplicador)
      : this.getPrecioGeneralPesos(funcionData, multiplicador);
  }

  async generarComprobanteEntrada(datos: {
    codigoUnico: string;
    asientos: any[];
    itemsCandy?: any[];
    total: number;
    metodoPago: string;
    funcionData?: any;
    cupones?: any[];
    enPreventa?: boolean;
    porcentajePreventa?: number;
  }): Promise<void> {
    const doc = new jsPDF();

    const pctPreventa = this.getPorcentajePreventa(datos.funcionData, datos.porcentajePreventa);
    const multiplicador = this.getMultiplicadorPreventa(
      datos.funcionData,
      datos.enPreventa,
      datos.porcentajePreventa,
    );
    const tienePreventa = multiplicador > 1;
    const porcentajeEtiqueta =
      pctPreventa > 0 ? pctPreventa : Number(datos.funcionData?.peliculas?.porcentaje_preventa ?? 50);

    // 🎬 Encabezado del Cine
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(33, 37, 41);
    doc.text('CINE - COMPROBANTE DE COMPRA', 20, 20);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(108, 117, 125);
    doc.text(`Fecha de emision: ${new Date().toLocaleDateString()}`, 20, 28);

    doc.setLineWidth(0.5);
    doc.line(20, 33, 190, 33);

    // 🎟️ Detalles de la Reserva
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(33, 37, 41);
    doc.text('Detalles de la Reserva:', 20, 41);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    let posY = 48;

    if (tienePreventa) {
      doc.setFont('helvetica', 'bold');
      doc.text(
        `Modalidad: Preventa anticipada (+${porcentajeEtiqueta}% sobre precio base)`,
        20,
        posY,
      );
      posY += 7;
      doc.setFont('helvetica', 'normal');
    }

    const asientos = datos.asientos || [];
    const itemsCandy = datos.itemsCandy || [];

    const cuposCombo = itemsCandy.reduce((acc: number, item: any) => {
      const cantEntradasPorCombo = Number(
        item?.cantidad_entradas ??
          item?.cantidadEntradas ??
          (item?.incluye_entrada || item?.incluyeEntrada ? 1 : 0),
      );
      if (cantEntradasPorCombo <= 0) return acc;
      const cantCombos = Number(item.cantidad || item.cantidadDeseada || 1);
      return acc + cantCombos * cantEntradasPorCombo;
    }, 0);

    const asientosOrdenados = [...asientos].sort((a, b) => {
      const filaA = a.fila || a.row || '';
      const filaB = b.fila || b.row || '';
      const vipA = this.esFilaVip(filaA) ? 1 : 0;
      const vipB = this.esFilaVip(filaB) ? 1 : 0;
      if (vipA !== vipB) return vipA - vipB;
      return String(filaA).localeCompare(String(filaB));
    });

    const diferenciaVip = Math.max(
      0,
      this.getPrecioVipPesos(datos.funcionData, multiplicador) -
        this.getPrecioGeneralPesos(datos.funcionData, multiplicador),
    );

    let recargoVipComboTotal = 0;
    let recargoPreventaEntradasSueltas = 0;

    if (asientosOrdenados.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text(`Asientos seleccionados (${asientosOrdenados.length}):`, 20, posY);
      posY += 6;
      doc.setFont('helvetica', 'normal');

      asientosOrdenados.forEach((a: any, idx: number) => {
        const fila = String(a.fila || a.row || '');
        const numero = a.numero_asiento || a.numero || a.col || '';
        const esVip = this.esFilaVip(fila);
        const etiquetas: string[] = [esVip ? 'VIP (+100%)' : 'General'];
        if (tienePreventa) {
          etiquetas.push(`Preventa +${porcentajeEtiqueta}%`);
        }

        const cubiertoPorCombo = cuposCombo > 0 && idx < cuposCombo;
        const precioBaseUnitario = this.getPrecioAsientoPesos(datos.funcionData, fila, 1);
        const precioUnitario = this.getPrecioAsientoPesos(datos.funcionData, fila, multiplicador);

        let lineaAsiento = ` - Fila ${fila} - Asiento ${numero} [${etiquetas.join(' | ')}]`;

        if (cubiertoPorCombo) {
          lineaAsiento += ' : Incluida en combo';
          if (esVip && diferenciaVip > 0) {
            recargoVipComboTotal += diferenciaVip;
            lineaAsiento += ` (+$${diferenciaVip.toFixed(2)} dif. VIP)`;
          }
        } else if (datos.funcionData) {
          if (tienePreventa) {
            recargoPreventaEntradasSueltas += Math.max(0, precioUnitario - precioBaseUnitario);
          }
          lineaAsiento += ` : $${precioUnitario.toFixed(2)}`;
        }

        doc.text(lineaAsiento, 25, posY);
        posY += 6;
      });

      if (tienePreventa && recargoPreventaEntradasSueltas > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text(
          ` - Recargo preventa entradas (+${porcentajeEtiqueta}%): +$${recargoPreventaEntradasSueltas.toFixed(2)}`,
          25,
          posY,
        );
        posY += 6;
        doc.setFont('helvetica', 'normal');
      }

      posY += 2;
    }

    if (itemsCandy.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Productos Candy Bar y Combos:', 20, posY);
      posY += 6;
      doc.setFont('helvetica', 'normal');

      itemsCandy.forEach((item: any) => {
        const nombreItem = item.nombre || 'Producto';
        const cantidadItem = Number(item.cantidad || item.cantidadDeseada || 1);
        const precioUnitario = Number(item.precio || item.precio_dinero || 0);
        const subtotalItem = cantidadItem * precioUnitario;
        const cantEntradas = Number(
          item?.cantidad_entradas ??
            item?.cantidadEntradas ??
            (item?.incluye_entrada || item?.incluyeEntrada ? 1 : 0),
        );

        let lineaCandy = ` - ${cantidadItem}x ${nombreItem} : $${subtotalItem.toFixed(2)}`;
        if (cantEntradas > 0) {
          lineaCandy += ` (Incluye ${cantidadItem * cantEntradas} entrada(s))`;
        }

        doc.text(lineaCandy, 25, posY);
        posY += 6;
      });

      if (recargoVipComboTotal > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text(
          ` - Ajuste diferencia VIP en combo: +$${recargoVipComboTotal.toFixed(2)}`,
          25,
          posY,
        );
        posY += 6;
        doc.setFont('helvetica', 'normal');
      }

      posY += 2;
    }

    if (datos.cupones && datos.cupones.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Cupones aplicados:', 20, posY);
      posY += 6;
      doc.setFont('helvetica', 'normal');

      datos.cupones.forEach((c: any) => {
        const pct =
          c?.discount_percentage ?? c?.descuento ?? c?.porcentaje_descuento ?? c?.porcentaje ?? 0;
        doc.text(` - ${c.code} (${pct}% OFF)`, 25, posY);
        posY += 6;
      });

      posY += 2;
    }

    doc.text(`Metodo de pago: ${datos.metodoPago.toUpperCase()}`, 20, posY);
    posY += 7;

    doc.setFont('helvetica', 'bold');
    doc.text(`Total abonado: $${Number(datos.total).toFixed(2)}`, 20, posY);
    posY += 9;

    doc.setFontSize(11);
    doc.text(`Codigo Unico de Retiro: ${datos.codigoUnico}`, 20, posY);
    posY += 12;

    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${datos.codigoUnico}`;

    try {
      const qrDataUrl = await this.convertirImagenABase64(qrApiUrl);
      doc.addImage(qrDataUrl, 'PNG', 20, posY, 40, 40);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(108, 117, 125);
      doc.text('Presenta este codigo QR en el ingreso a la sala o confiteria.', 20, posY + 45);
    } catch (e) {
      console.error('Error al incrustar el codigo QR en el PDF', e);
    }

    doc.save(`Comprobante-Cine-${datos.codigoUnico}.pdf`);
  }

  private convertirImagenABase64(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } else {
          reject(new Error('No se pudo inicializar el contexto del canvas'));
        }
      };
      img.onerror = (error) => reject(error);
      img.src = url;
    });
  }
}