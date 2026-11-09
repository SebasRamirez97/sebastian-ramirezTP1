import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'dateFormat',
  standalone: true
})
export class DateFormatPipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    if (!value) return '';

    // Si viene como string ISO de Supabase o formato YYYY-MM-DD
    const valueStr = String(value);
    const fechaLimpia = valueStr.split('T')[0]; // Extrae "YYYY-MM-DD"

    if (/^\d{4}-\d{2}-\d{2}$/.test(fechaLimpia)) {
      const [year, month, day] = fechaLimpia.split('-');
      return `${day}/${month}/${year}`;
    }

    // Fallback por si llega un objeto Date nativo
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);

    // Usamos métodos UTC para evitar que la zona horaria altere el día local
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();

    return `${day}/${month}/${year}`;
  }
}