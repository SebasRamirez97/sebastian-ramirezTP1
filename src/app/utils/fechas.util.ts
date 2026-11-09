// src/app/utils/fechas.util.ts
export function formatearFechaLocal(fecha: Date | string): string {
  if (!fecha) return '';
  
  // Si ya es un string con formato YYYY-MM-DD puro, lo devolvemos directo sin crear un objeto Date
  if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return fecha;
  }
  
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return String(fecha); 

  const anio = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');

  return `${anio}-${mes}-${dia}`;
}