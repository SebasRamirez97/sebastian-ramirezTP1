import { Injectable } from '@angular/core';
import { supabase } from './supabaseClient'; // Ajusta la ruta a tu cliente de Supabase

@Injectable({
  providedIn: 'root',
})
export class EntradasService {
  constructor() {}

  /**
   * Genera un código aleatorio limpio de 7 letras mayúsculas
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
    const { data, error } = await supabase.from('entradas').select('*').eq('funcion_id', funcionId);

    if (error) {
      throw new Error(`Error al cargar los asientos: ${error.message}`);
    }
    return data || [];
  }

  /**
   * Bloquea un asiento inmediatamente al hacer clic (Acepta string o null para usuarioId)
   */
  async bloquearAsiento(
    funcionId: string,
    usuarioId: string | null,
    fila: string,
    numeroAsiento: number,
  ): Promise<any> {
    // Quitamos .single() y .select() complejos que causan el conflicto 400
    const { data, error } = await supabase
      .from('entradas')
      .insert([
        {
          funcion_id: funcionId,
          usuario_id: usuarioId,
          fila: fila,
          numero_asiento: numeroAsiento,
          estado: 'seleccionado',
          aprobada: false,
        }
      ])
      .select(); // Devolvemos el array insertado sin forzar .single()

    if (error) {
      if (error.code === '23505') {
        throw new Error('Este asiento acaba de ser seleccionado por otro usuario.');
      }
      throw new Error(`No se pudo seleccionar el asiento: ${error.message}`);
    }

    // Retornamos el primer elemento insertado con éxito
    return data && data.length > 0 ? data[0] : null;
  }

  /**
   * Libera/Borra el asiento si el usuario lo deselecciona o cancela
   */
  async liberarAsiento(entradaId: string): Promise<void> {
    const { error } = await supabase.from('entradas').delete().eq('id', entradaId);

    if (error) {
      throw new Error(`Error al liberar el asiento: ${error.message}`);
    }
  }

  /**
   * Confirma la compra: Calcula el total y genera la orden unificada.
   */
  async confirmarCompra(usuarioId: string | null, asientosSeleccionados: any[], metodoPago: string = 'efectivo'): Promise<string> {
    if (asientosSeleccionados.length === 0) {
      throw new Error('No hay asientos seleccionados para comprar.');
    }

    const funcionId = asientosSeleccionados[0].funcion_id;

    const { data: funcionData, error: errorFuncion } = await supabase
      .from('funciones')
      .select('precio_pesos, precio_puntos')
      .eq('id', funcionId)
      .single();

    if (errorFuncion || !funcionData) {
      throw new Error('No se pudo obtener la información de precios de la función.');
    }

    let totalCalculado = 0;
    
    if (metodoPago === 'puntos') {
      const precioPuntosUnitario = funcionData.precio_puntos || 0;
      totalCalculado = asientosSeleccionados.length * precioPuntosUnitario;
    } else {
      const precioPesosUnitario = funcionData.precio_pesos || 0;
      totalCalculado = asientosSeleccionados.length * precioPesosUnitario;
    }

    const codigoUnico = this.generarCodigoRetiro();
    const idsAsientos = asientosSeleccionados.map((a) => a.id);

    // Creamos la orden principal permitiendo usuario_id nulo si es anónimo
    const { data: orden, error: errorOrden } = await supabase
      .from('ordenes')
      .insert([
        {
          usuario_id: usuarioId, // Puede ser null para invitados
          codigo_retiro: codigoUnico,
          estado: 'pagado',
          total: totalCalculado,
          metodo_pago: metodoPago
        },
      ])
      .select()
      .single();

    if (errorOrden) throw new Error(`Error al generar la orden: ${errorOrden.message}`);

    const { error: errorEntradas } = await supabase
      .from('entradas')
      .update({
        estado: 'comprado',
        orden_id: orden.id,
      })
      .in('id', idsAsientos);

    if (errorEntradas) throw new Error(`Error al actualizar entradas: ${errorEntradas.message}`);

    return codigoUnico;
  }

  async confirmarCompraConCandy(
  usuarioId: string | null,
  asientos: any[] = [], // 👈 Ahora puede venir vacío si es solo candy
  metodoPago: string,
  itemsCandyJson: any[] = [],
  itemsConIdsFisicos: any[] = []
): Promise<string> {
  const codigoRetiro = Math.random().toString(36).substring(2, 8).toUpperCase();

  // 1. Creamos la orden principal (siempre se crea, tenga o no entradas)
  const { data: ordenCreada, error: errorOrden } = await supabase
    .from('ordenes')
    .insert([
      {
        usuario_id: usuarioId,
        codigo_retiro: codigoRetiro,
        metodo_pago: metodoPago,
        estado: 'pagado',
        items_candy: itemsCandyJson.length > 0 ? itemsCandyJson : null
      }
    ])
    .select()
    .single();

  if (errorOrden) throw errorOrden;

  // 2. 🎟️ Solo si hay asientos seleccionados, los actualizamos y vinculamos
  if (asientos && asientos.length > 0) {
    const idsAsientos = asientos.map(a => a.id);
    const { error: errorAsientos } = await supabase
      .from('entradas')
      .update({ estado: 'ocupado', orden_id: ordenCreada.id })
      .in('id', idsAsientos);

    if (errorAsientos) throw errorAsientos;
  }

  // 3. 🍿 Si hay productos del Candy Bar, reservamos los IDs físicos y los vinculamos
  const idsFisicosAreservar: string[] = [];
  itemsConIdsFisicos.forEach(item => {
    if (item.idsFisicos) {
      idsFisicosAreservar.push(...item.idsFisicos);
    }
  });

  if (idsFisicosAreservar.length > 0) {
    const { error: errorReserva } = await supabase
      .from('productos')
      .update({
        estado: 'reservado',
        orden_id: ordenCreada.id
      })
      .in('id', idsFisicosAreservar);

    if (errorReserva) throw errorReserva;
  }

  return codigoRetiro;
}
}