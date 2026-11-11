import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';

@Injectable({
  providedIn: 'root'
})
export class PdfService {

  async generarComprobanteEntrada(datos: {
    codigoUnico: string;
    asientos: any[];
    itemsCandy?: any[]; // 👈 Añadimos opcionalmente los productos de candy
    total: number;
    metodoPago: string;
  }): Promise<void> {
    const doc = new jsPDF();

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

    // Si hay asientos, los listamos
    if (datos.asientos && datos.asientos.length > 0) {
      const asientosTexto = datos.asientos.map(a => `Fila ${a.fila || a.row} - Asiento ${a.numero_asiento || a.numero || a.col}`).join(', ');
      doc.text(`Asientos: ${asientosTexto}`, 20, posY);
      posY += 7;
    }

    // 🍿 Si hay productos de Candy Bar, los listamos detalladamente
    if (datos.itemsCandy && datos.itemsCandy.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Productos Candy Bar:', 20, posY);
      posY += 6;
      doc.setFont('helvetica', 'normal');

      datos.itemsCandy.forEach((item: any) => {
        const nombreItem = item.nombre || 'Producto';
        const cantidadItem = item.cantidad || item.cantidadDeseada || 1;
        const precioUnitario = Number(item.precio || item.precio_dinero || 0);
        const subtotalItem = cantidadItem * precioUnitario;

        doc.text(` - ${cantidadItem}x ${nombreItem} ($${subtotalItem})`, 25, posY);
        posY += 6;
      });
    }

    posY += 2;
    doc.text(`Metodo de pago: ${datos.metodoPago.toUpperCase()}`, 20, posY);
    posY += 7;
    doc.text(`Total abonado: $${datos.total}`, 20, posY);
    posY += 9;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`Codigo Unico de Retiro: ${datos.codigoUnico}`, 20, posY);
    posY += 12;

    // 📱 Generación e incrustación del Código QR
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${datos.codigoUnico}`;

    try {
      const qrDataUrl = await this.convertirImagenABase64(qrApiUrl);
      // Dibujar imagen QR en el PDF (coordenada X, Y, ancho, alto)
      doc.addImage(qrDataUrl, 'PNG', 20, posY, 40, 40);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(108, 117, 125);
      doc.text('Presenta este codigo QR en el ingreso a la sala o confiteria.', 20, posY + 45);
    } catch (e) {
      console.error('Error al incrustar el codigo QR en el PDF', e);
    }

    // 📥 Descargar el archivo PDF automáticamente
    doc.save(`Comprobante-Cine-${datos.codigoUnico}.pdf`);
  }

  // Helper privado para transformar la imagen del QR a formato Base64 aceptado por jsPDF
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
      img.onerror = error => reject(error);
      img.src = url;
    });
  }
}