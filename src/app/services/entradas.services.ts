import { Injectable } from '@angular/core';
import { supabase } from './supabaseClient'; // Ajusta la ruta a tu cliente de Supabase

@Injectable({
  providedIn: 'root',
})
export class EntradasService { 

  constructor() {}

  /**
   * Genera un código aleatorio de 7 letras mayúsculas (Ej: A B C 1 D E F -> o solo letras: X Y Z W Q R T)
   */
  private generarCodigoRetiro(): string {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let codigo = '';
    for (let i = 0; i < 7; i++) {
      codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return codigo;
  }

  /**
   * Obtiene todas las entradas existentes para una función específica
   */
  async getEntradasPorFuncion(funcionId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('entradas')
      .select('*')
      .eq('funcion_id', funcionId);

    if (error) {
      throw new Error(`Error al cargar los asientos: ${error.message}`);
    }
    return data || [];
  }

  /**
   * Bloquea un asiento inmediatamente al hacer clic (Estado: 'seleccionado')
   */
  async bloquearAsiento(funcionId: string, usuarioId: string, fila: string, numeroAsiento: number): Promise<any> {
    const codigoRetiro = this.generarCodigoRetiro();

    const { data, error } = await supabase
      .from('entradas')
      .insert([
        {
          funcion_id: funcionId,
          usuario_id: usuarioId,
          fila: fila,
          numero_asiento: numeroAsiento,
          estado: 'seleccionado',
          codigo_retiro: codigoRetiro,
          aprobada: false
        }
      ])
      .select()
      .single();

    if (error) {
      // Si el código de error es por llave duplicada, significa que otro usuario se adelantó por milisegundos
      if (error.code === '23505') {
        throw new Error('Este asiento acaba de ser seleccionado por otro usuario.');
      }
      throw new Error(`No se pudo seleccionar el asiento: ${error.message}`);
    }

    return data;
  }

  /**
   * Libera/Borra el asiento si el usuario lo deselecciona o cancela
   */
  async liberarAsiento(entradaId: string): Promise<void> {
    const { error } = await supabase
      .from('entradas')
      .delete()
      .eq('id', entradaId);

    if (error) {
      throw new Error(`Error al liberar el asiento: ${error.message}`);
    }
  }

  /**
   * Confirma la compra de los asientos seleccionados (Pasa de 'seleccionado' a 'comprado')
   */
  async confirmarCompra(ids: string[]): Promise<string> {
  // 1. Generamos un único código de retiro para toda la compra (ej: un código alfanumérico aleatorio)
  const codigoUnico = 'CINE-' + Math.random().toString(36).substring(2, 8).toUpperCase();

  // 2. Actualizamos todos los registros cuyos IDs estén en el array, asignándoles el mismo código
  const { error } = await supabase
    .from('entradas')
    .update({ 
      estado: 'comprado', 
      codigo_retiro: codigoUnico 
    })
    .in('id', ids);

  if (error) throw new Error(error.message);

  return codigoUnico; // Devolvemos el código único por si quieres mostrarlo en una alerta
}
}