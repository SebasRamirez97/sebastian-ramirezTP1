import { Injectable } from '@angular/core';
import { supabase } from './supabaseClient'; // Ajusta la ruta a tu cliente de Supabase

@Injectable({
  providedIn: 'root',
})
export class EntradasService {
  constructor() {}

  /**
   * Genera un código aleatorio limpio de 7 letras mayúsculas (Ej: X Y Z W Q R T)
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
   * Bloquea un asiento inmediatamente al hacer clic (Estado: 'seleccionado')
   * Nota: Ya no incluimos codigo_retiro aquí porque ahora pertenece a la tabla 'ordenes'
   */
  async bloquearAsiento(
    funcionId: string,
    usuarioId: string,
    fila: string,
    numeroAsiento: number,
  ): Promise<any> {
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
        },
      ])
      .select()
      .single();

    if (error) {
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
    const { error } = await supabase.from('entradas').delete().eq('id', entradaId);

    if (error) {
      throw new Error(`Error al liberar el asiento: ${error.message}`);
    }
  }

  /**
   * Confirma la compra: Consulta los precios (pesos y puntos) de la función, 
   * calcula el total según el método elegido y genera la orden unificada.
   */
  async confirmarCompra(usuarioId: string, asientosSeleccionados: any[], metodoPago: string = 'efectivo'): Promise<string> {
    if (asientosSeleccionados.length === 0) {
      throw new Error('No hay asientos seleccionados para comprar.');
    }

    // 1. Tomamos el funcion_id del primer asiento para consultar los precios en la BD
    const funcionId = asientosSeleccionados[0].funcion_id;

    const { data: funcionData, error: errorFuncion } = await supabase
      .from('funciones')
      .select('precio_pesos, precio_puntos') // <--- Consultamos ambas columnas
      .eq('id', funcionId)
      .single();

    if (errorFuncion || !funcionData) {
      throw new Error('No se pudo obtener la información de precios de la función.');
    }

    // 2. Calculamos el total dependiendo de si paga con pesos o con puntos
    let totalCalculado = 0;
    
    if (metodoPago === 'puntos') {
      const precioPuntosUnitario = funcionData.precio_puntos || 0;
      totalCalculado = asientosSeleccionados.length * precioPuntosUnitario;
    } else {
      const precioPesosUnitario = funcionData.precio_pesos || 0;
      totalCalculado = asientosSeleccionados.length * precioPesosUnitario;
    }

    // 3. Generamos el código único y los IDs de los asientos
    const codigoUnico = this.generarCodigoRetiro();
    const idsAsientos = asientosSeleccionados.map((a) => a.id);

    // 4. Creamos la orden principal en la tabla 'ordenes' guardando el total y el método de pago
    const { data: orden, error: errorOrden } = await supabase
      .from('ordenes')
      .insert([
        {
          usuario_id: usuarioId,
          codigo_retiro: codigoUnico,
          estado: 'pagado',
          total: totalCalculado,
          metodo_pago: metodoPago // 'efectivo'/'pesos' o 'puntos'
        },
      ])
      .select()
      .single();

    if (errorOrden) throw new Error(`Error al generar la orden: ${errorOrden.message}`);

    // 5. Actualizamos los asientos vinculándolos a esta orden y pasándolos a 'comprado'
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
}